// macOS: Music and Spotify through AppleScript, polled. pgrep finds the
// running apps first, so no app is ever launched and no script is compiled
// against an app that is not installed.

import type { SoundAction, SoundStatus, Track } from '../../types'
import type { SoundBackend, SoundHost } from './types'

type App = 'Music' | 'Spotify'
type Reading = Track & { state: 'playing' | 'paused' }

const APPS: readonly App[] = ['Music', 'Spotify']
const POLL_MS = 2000
const VERBS: Readonly<Record<SoundAction, string>> = { 'play-pause': 'playpause', next: 'next track', previous: 'previous track' }
const DENIED = '-1743'

export function appScript(app: App): string {
  return [
    `tell application "${app}"`,
    '  try',
    '    if player state is stopped then return "stopped"',
    '    return (player state as text) & tab & (artist of current track) & tab & (name of current track)',
    '  on error',
    '    return "stopped"',
    '  end try',
    'end tell',
  ].join('\n')
}

export function parseAppleScript(app: string, out: string): Reading | null {
  const [state, artist, ...title] = out.replace(/\r?\n$/, '').split('\t')
  if ((state !== 'playing' && state !== 'paused') || artist === undefined) return null
  return { app, title: title.join('\t'), artist, state }
}

/** A playing app wins; otherwise the paused app shown last; otherwise any paused app. */
export function choosePlayer(readings: readonly Reading[], lastPausedApp: string | null): SoundStatus {
  const pick =
    readings.find(r => r.state === 'playing') ??
    readings.find(r => r.app === lastPausedApp) ??
    readings[0]
  if (pick === undefined) return { kind: 'nothing' }
  const { state, ...track } = pick
  return { kind: state, track }
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
      return (await host.run(['osascript', '-e', `tell application "${app}" to ${VERBS[action]}`])).exitCode === 0
    } catch {
      return false
    }
  },
}
