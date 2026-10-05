// Linux: MPRIS players through playerctl, followed by one long-lived process.

import type { SoundStatus } from '../../types'
import { watchLines } from './supervisor'
import type { SoundBackend } from './types'

const FORMAT = '{{status}}\t{{playerName}}\t{{artist}}\t{{title}}'
const FOLLOW = ['playerctl', '--follow', 'metadata', '--format', FORMAT] as const
const ACTIONS = { 'play-pause': 'play-pause', next: 'next', previous: 'previous' } as const

const KNOWN_PLAYERS: Readonly<Record<string, string>> = { vlc: 'VLC', mpv: 'mpv' }

/** An MPRIS player name as an app name, its instance suffix dropped. */
export function playerName(raw: string): string {
  const base = raw.split('.')[0] ?? raw
  return KNOWN_PLAYERS[base.toLowerCase()] ?? base.charAt(0).toUpperCase() + base.slice(1)
}

export function parsePlayerctlLine(line: string): SoundStatus | null {
  if (line.trim() === '') return { kind: 'nothing' }
  const [status, player, artist, ...title] = line.split('\t')
  if (status === undefined || player === undefined || artist === undefined || title.length === 0) return null
  const track = { app: playerName(player), title: title.join('\t'), artist }
  if (status === 'Playing') return { kind: 'playing', track }
  if (status === 'Paused') return { kind: 'paused', track }
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
