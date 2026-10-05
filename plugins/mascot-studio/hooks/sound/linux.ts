// Linux: MPRIS players through playerctl, followed by one long-lived process.

import type { SoundStatus } from '../../types'
import { lookup, plainText, trackText } from '../text'
import { numberIn, progressOf } from './progress'
import { watchLines } from './supervisor'
import type { SoundBackend } from './types'

const FORMAT = '{{status}}\t{{playerName}}\t{{artist}}\t{{title}}\t{{position}}\t{{mpris:length}}'
const FOLLOW = ['playerctl', '--follow', 'metadata', '--format', FORMAT] as const
const ACTIONS = { 'play-pause': 'play-pause', next: 'next', previous: 'previous' } as const

const KNOWN_PLAYERS: Readonly<Record<string, string>> = { vlc: 'VLC', mpv: 'mpv' }

/** An MPRIS player name as an app name, its instance suffix dropped. */
export function playerName(raw: string): string {
  const base = plainText(raw.split('.')[0] ?? raw)
  return lookup(KNOWN_PLAYERS, base.toLowerCase()) ?? base.charAt(0).toUpperCase() + base.slice(1)
}

/** A `--follow` line: status, player, artist, title, then position and length in microseconds (a title may hold tabs). */
export function parsePlayerctlLine(line: string): SoundStatus | null {
  if (line.trim() === '') return { kind: 'nothing' }
  const fields = line.split('\t')
  const [status, player, artist] = fields
  if (status === undefined || player === undefined || artist === undefined || fields.length < 4) return null
  const hasTimes = fields.length >= 6
  const title = (hasTimes ? fields.slice(3, -2) : fields.slice(3)).join('\t')
  const track = { app: playerName(player), title: trackText(title), artist: trackText(artist) }
  const progress = hasTimes ? progressOf(numberIn(fields.at(-2)) / 1e6, numberIn(fields.at(-1)) / 1e6) : undefined
  const extra = progress === undefined ? {} : { progress }
  if (status === 'Playing') return { kind: 'playing', track, ...extra }
  if (status === 'Paused') return { kind: 'paused', track, ...extra }
  return { kind: 'nothing' }
}

export const linuxBackend: SoundBackend = {
  watch: (host, onStatus) => {
    let stop: (() => void) | undefined
    let isStopped = false
    void (async () => {
      const ok = await host.run(['playerctl', '--version']).then(
        done => done.exitCode === 0,
        () => false,
      )
      if (isStopped) return
      if (!ok) {
        onStatus({ kind: 'unavailable', reason: 'missing-playerctl' })
        return
      }
      stop = watchLines(host, FOLLOW, parsePlayerctlLine, onStatus)
    })()
    return () => {
      isStopped = true
      stop?.()
    }
  },
  control: async (host, action) => {
    try {
      return (await host.run(['playerctl', ACTIONS[action]])).exitCode === 0
    } catch {
      return false
    }
  },
}
