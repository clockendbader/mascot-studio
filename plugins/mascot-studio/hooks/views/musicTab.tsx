import type { Elements } from 'claude-code'

import type { SoundStatus } from '../../types'
import type { RowSegment } from '../client/row'
import type { Theme } from '../themes'
import { fitRow } from './chrome'

type Els = Elements['terminal']
type Tree = ReturnType<Els['Box']>

export type MusicTabVM = { cols: number; height: number; theme: Theme; status: SoundStatus }

/** The DJ blob's raster width; it is 5 rows tall. */
export const DJ_COLS = 10
/** From this many rows the tab shows its header and the DJ blob; below, just the song. */
const FULL_ROWS = 6
/** Columns left of the song in the full layout: a margin, the DJ blob and a gap. */
const LEFT_COLS = 1 + DJ_COLS + 2

export type MusicLayout = { full: boolean; rightCols: number; progressCols: number }

/** Where the song column sits in a tab `cols` wide and `height` rows tall. */
export function musicLayout(cols: number, height: number): MusicLayout {
  const full = height >= FULL_ROWS
  const rightCols = Math.max(1, full ? cols - LEFT_COLS : cols - 1)
  return { full, rightCols, progressCols: Math.max(1, rightCols - 1) }
}

const EXPLAIN: Readonly<Record<string, string>> = {
  'missing-playerctl': 'Install playerctl to connect music.',
  'automation-denied': 'Allow Automation for your terminal in System Settings › Privacy & Security › Automation.',
  'unsupported-os': "Music can't reach a player on this system.",
}

/** What the tab says instead of a song, or null when a song shows. */
export function musicMessage(status: SoundStatus): { title: string; detail: string } | null {
  if (status.kind === 'playing' || status.kind === 'paused') return null
  if (status.kind === 'unavailable') return { title: 'Music is not connected', detail: EXPLAIN[status.reason] ?? '' }
  if (status.kind === 'stopped') return { title: 'Music stopped after repeated errors', detail: 'Retry to reconnect.' }
  return { title: 'No music playing', detail: 'Play a song in Spotify, Apple Music or a browser.' }
}

/** The transport buttons ◀◀ ❚❚ ▶▶ (keys b p n) for a song, retry (r) when the helper stopped, or null. */
export function musicControls(theme: Theme, width: number, status: SoundStatus): RowSegment[] | null {
  const { bg, text, button } = theme.music
  const gap = (): RowSegment => ({ id: '', text: ' ', fg: text, bg })
  const press = (id: string, label: string, key: string): RowSegment => ({ id, text: label, fg: button.fg, bg: button.bg, hoverBg: button.hover, key })
  if (status.kind === 'stopped') return fitRow([press('retry', ' ↻ retry ', 'r')], width, bg, text)
  if (status.kind !== 'playing' && status.kind !== 'paused') return null
  const isPlaying = status.kind === 'playing'
  return fitRow(
    [
      press('back', ' ◀◀ ', 'b'),
      gap(),
      press('play', isPlaying ? ' ❚❚ ' : ' ▶ ', 'p'),
      // the play button is a column narrower than pause: keep skip where it was
      ...(isPlaying ? [] : [gap()]),
      gap(),
      press('skip', ' ▶▶ ', 'n'),
    ],
    width,
    bg,
    text,
  )
}

/** The tab when music is turned off in the plugin's options. */
export function musicOffView(els: Els, theme: Theme): Tree {
  const { Box, Text } = els
  return (
    <Box backgroundColor={theme.body}>
      <Text color={theme.ink}>{' Music is off. Turn it on with /plugin configure.'}</Text>
    </Box>
  )
}

/** The Music tab: the DJ blob, the song, its progress and the transport buttons, on the theme's music panel. */
export function musicTabView(els: Els, vm: MusicTabVM, dj: Tree | null, progress: Tree | null, controls: Tree | null): Tree {
  const { Box, Text } = els
  const music = vm.theme.music
  const { full, rightCols } = musicLayout(vm.cols, vm.height)
  const { status } = vm
  const message = musicMessage(status)
  const pad = (width: number) => (
    <Text color={music.bg} backgroundColor={music.bg}>
      {' '.repeat(width)}
    </Text>
  )

  const song: Tree[] = []
  if (status.kind === 'playing' || status.kind === 'paused') {
    const { title, artist, app } = status.track
    song.push(
      <Text color={music.text} bold wrap="truncate-end">
        {full ? title || 'Untitled' : `♪ ${title || 'Untitled'}`}
      </Text>,
      <Text color={music.soft} wrap="truncate-end">
        {full ? artist || ' ' : [artist, app].filter(part => part !== '').join(' · ') || ' '}
      </Text>,
    )
    if (full) song.push(pad(1))
    if (progress !== null) song.push(progress)
  } else if (message !== null) {
    song.push(
      <Text color={music.text} bold wrap="truncate-end">
        {message.title}
      </Text>,
      <Text color={music.soft} wrap="wrap">
        {message.detail}
      </Text>,
    )
  }
  if (controls !== null) song.push(controls)

  const column = (
    <Box key="song" flexDirection="column" width={rightCols}>
      {song}
    </Box>
  )
  if (!full) {
    return (
      <Box flexDirection="row" width={vm.cols} height={vm.height} backgroundColor={music.bg}>
        {pad(1)}
        {column}
      </Box>
    )
  }
  const header =
    status.kind === 'playing' || status.kind === 'paused'
      ? ` ♪ ${status.kind === 'playing' ? 'Now playing' : 'Paused'} · ${status.track.app}`
      : ' ♪ Music'
  return (
    <Box flexDirection="column" width={vm.cols} height={vm.height} backgroundColor={music.bg}>
      <Text color={music.soft} bold wrap="truncate-end">
        {header}
      </Text>
      <Box flexDirection="row">
        {pad(1)}
        {dj}
        {pad(2)}
        {column}
      </Box>
    </Box>
  )
}
