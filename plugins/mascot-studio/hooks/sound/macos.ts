// macOS: Music and Spotify through AppleScript, polled. pgrep finds the
// running apps first, so no app is ever launched and no script is compiled
// against an app that is not installed.

import type { Progress, SoundAction, SoundStatus, Track } from '../../types'
import { numberIn, progressOf } from './progress'
import type { SoundBackend, SoundHost } from './types'

type App = 'Music' | 'Spotify'
type Reading = Track & { state: 'playing' | 'paused'; progress?: Progress }

const APPS: readonly App[] = ['Music', 'Spotify']
const POLL_MS = 2000
const VERBS: Readonly<Record<SoundAction, string>> = { 'play-pause': 'playpause', next: 'next track', previous: 'previous track' }
const DENIED = '-1743'

export function appScript(app: App): string {
  return [
    `tell application "${app}"`,
    '  try',
    '    if player state is stopped then return "stopped"',
    '    set head to (player state as text) & tab & (artist of current track) & tab & (name of current track)',
    '  on error',
    '    return "stopped"',
    '  end try',
    '  set pos to ""',
    '  set len to ""',
    '  try',
    '    set pos to (player position as text)',
    '    set len to ((duration of current track) as text)',
    '  end try',
    '  return head & tab & pos & tab & len',
    'end tell',
  ].join('\n')
}

/** The one-line script that sends a transport action to an app. */
export function controlScript(app: App, action: SoundAction): string {
  return `tell application "${app}" to ${VERBS[action]}`
}

/** The script's line: state, artist, title, then position and length (Spotify's length in milliseconds); a title may hold tabs. */
export function parseAppleScript(app: string, out: string): Reading | null {
  const fields = out.replace(/\r?\n$/, '').split('\t')
  const [state, artist] = fields
  if ((state !== 'playing' && state !== 'paused') || artist === undefined) return null
  const hasTimes = fields.length >= 5
  const title = (hasTimes ? fields.slice(2, -2) : fields.slice(2)).join('\t')
  const lengthScale = app === 'Spotify' ? 1000 : 1
  const progress = hasTimes ? progressOf(numberIn(fields.at(-2)), numberIn(fields.at(-1)) / lengthScale) : undefined
  return { app, title, artist, state, ...(progress === undefined ? {} : { progress }) }
}

/** A playing app wins; otherwise the paused app shown last; otherwise any paused app. */
export function choosePlayer(readings: readonly Reading[], lastPausedApp: string | null): SoundStatus {
  const pick =
    readings.find(r => r.state === 'playing') ??
    readings.find(r => r.app === lastPausedApp) ??
    readings[0]
  if (pick === undefined) return { kind: 'nothing' }
  const { state, progress, ...track } = pick
  return { kind: state, track, ...(progress === undefined ? {} : { progress }) }
}

async function poll(host: SoundHost, lastApp: string | null): Promise<SoundStatus> {
  const readings: Reading[] = []
  for (const app of APPS) {
    const running = await host.run(['pgrep', '-x', app]).then(
      done => done.exitCode === 0,
      () => false,
    )
    if (!running) continue
    const done = await host.run(['osascript', '-e', appScript(app)])
    if (done.stderr.includes(DENIED)) return { kind: 'unavailable', reason: 'automation-denied' }
    const reading = done.exitCode === 0 ? parseAppleScript(app, done.stdout) : null
    if (reading !== null) readings.push(reading)
  }
  return choosePlayer(readings, lastApp)
}

export const macosBackend: SoundBackend = {
  watch: (host, onStatus) => {
    let lastApp: string | null = null
    let isPolling = false
    const tick = async () => {
      if (isPolling) return
      isPolling = true
      try {
        const status = await poll(host, lastApp)
        if (status.kind === 'playing' || status.kind === 'paused') lastApp = status.track.app
        onStatus(status)
      } catch {
        // a failed poll is skipped; the next one tries again
      } finally {
        isPolling = false
      }
    }
    void tick()
    const timer = host.every(POLL_MS, () => {
      void tick()
    })
    return () => timer.cancel()
  },
  control: async (host, action, track) => {
    const app = APPS.find(a => a === track?.app)
    if (app === undefined) return false
    try {
      return (await host.run(['osascript', '-e', controlScript(app, action)])).exitCode === 0
    } catch {
      return false
    }
  },
}
