// The themed window chrome: the title bar (a gradient raster row plus a
// clickable text row), the tab row and the status bar. Each text row is a list
// of segments that client/row.tsx draws and makes clickable; `segmentsText`
// draws the same segments as plain Text when a Client is not available.

import type { Elements } from 'claude-code'

import type { Tab } from '../../types'
import type { RowSegment } from '../client/row'
import { DEFAULT_COLOR, textWords, wordsToCells } from '../art/pixels'
import type { Theme } from '../themes'

type Els = Elements['terminal']

export const TITLE = 'Clawd Studio'
export const TABS: readonly { tab: Tab; label: string; key: string }[] = [
  { tab: 'timeline', label: 'Timeline', key: '1' },
  { tab: 'usage', label: 'Usage', key: '2' },
  { tab: 'music', label: 'Music', key: '3' },
]
const CLOSE_RED = '#C75050'
const CLOSE_HOVER = '#E04343'
const TRAFFIC = ['#FF5F57', '#FEBC2E', '#28C840'] as const
const UBUNTU_GREY = '#8A8780'
const CLAWD_ORANGE = '#D97757'

const len = (s: string) => [...s].length
const plain = (text: string, fg: string, bg: string, bold = false): RowSegment => ({ id: '', text, fg, bg, bold })

/** Pads (or cuts) a row of segments to exactly `cols` cells, the padding in `fill`. */
export function fitRow(segments: readonly RowSegment[], cols: number, fill: string, fillFg: string): RowSegment[] {
  const out: RowSegment[] = []
  let used = 0
  for (const seg of segments) {
    if (used >= cols) break
    const room = cols - used
    const text = len(seg.text) <= room ? seg.text : [...seg.text].slice(0, room).join('')
    out.push({ ...seg, text })
    used += len(text)
  }
  if (used < cols) out.push(plain(' '.repeat(cols - used), fillFg, fill))
  return out
}

function mixHex(a: string, b: string, t: number): number {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  const ch = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * t) << s
  return ch(16) | ch(8) | ch(0)
}

/** The title bar's top raster row: a glossy gradient with rounded corners. */
export function chromeCells(theme: Theme, cols: number): string {
  const top = parseInt(theme.title.top.slice(1), 16)
  const lower = mixHex(theme.title.top, theme.title.bottom, 0.6)
  const words = new Uint32Array(cols * 3)
  for (let i = 0; i < cols; i++) {
    const corner = i === 0 || i === cols - 1
    words[i * 3] = 0x2580
    words[i * 3 + 1] = corner ? DEFAULT_COLOR : top
    words[i * 3 + 2] = lower
  }
  return wordsToCells(words)
}

/** The title row: the window buttons where the theme puts them, the title, and a clickable close. */
export function titleSegments(theme: Theme, cols: number): RowSegment[] {
  const bg = theme.title.bottom
  const ink = theme.title.text
  if (theme.title.buttons === 'traffic') {
    const lights: RowSegment[] = [
      plain(' ', ink, bg),
      { id: 'close', text: '●', fg: TRAFFIC[0], bg, hoverBg: theme.title.top },
      plain(' ', ink, bg),
      plain('●', TRAFFIC[1], bg),
      plain(' ', ink, bg),
      plain('●', TRAFFIC[2], bg),
    ]
    const before = Math.max(1, Math.floor((cols - len(TITLE)) / 2) - 6)
    return fitRow([...lights, plain(' '.repeat(before), ink, bg), plain(TITLE, ink, bg, true)], cols, bg, ink)
  }
  if (theme.title.buttons === 'ubuntu') {
    return fitRow(
      [
        plain(' ', ink, bg),
        { id: 'close', text: '●', fg: theme.accent, bg, hoverBg: theme.title.top },
        plain(' ', ink, bg),
        plain('●', UBUNTU_GREY, bg),
        plain(' ', ink, bg),
        plain('●', UBUNTU_GREY, bg),
        plain('  ', ink, bg),
        plain(TITLE, ink, bg, true),
      ],
      cols,
      bg,
      ink,
    )
  }
  const right = [plain(' ─ ', ink, bg), plain(' □ ', ink, bg), { id: 'close', text: ' ✕ ', fg: '#FFFFFF', bg: CLOSE_RED, hoverBg: CLOSE_HOVER, bold: true }]
  const left = [plain(' ', ink, bg), plain('◆', CLAWD_ORANGE, bg, true), plain(' ', ink, bg), plain(TITLE, ink, bg)]
  const gap = Math.max(1, cols - left.reduce((n, s) => n + len(s.text), 0) - right.reduce((n, s) => n + len(s.text), 0))
  return fitRow([...left, plain(' '.repeat(gap), ink, bg), ...right], cols, bg, ink)
}

/** The tab row: the active tab drawn as such, the others clickable (keys 1, 2, 3). */
export function tabSegments(theme: Theme, cols: number, active: Tab): RowSegment[] {
  const { tabs } = theme
  const segments: RowSegment[] = [plain(' ', tabs.text, tabs.bar)]
  for (const t of TABS) {
    const label = ` ${t.label} `
    segments.push(
      t.tab === active
        ? { id: `tab:${t.tab}`, text: label, fg: tabs.activeText, bg: tabs.active, bold: true, key: t.key }
        : { id: `tab:${t.tab}`, text: label, fg: tabs.text, bg: tabs.idle, hoverBg: tabs.hover, key: t.key },
    )
    segments.push(plain(' ', tabs.text, tabs.bar))
  }
  return fitRow(segments, cols, tabs.bar, tabs.text)
}

export type StatusFigures = { context?: number; fiveHour?: number; song?: string }

/** The status bar: usage figures that open Usage, the song that opens Music. */
export function statusSegments(theme: Theme, cols: number, s: StatusFigures): RowSegment[] {
  const { bg, text } = theme.status
  const segments: RowSegment[] = [plain(' ', text, bg)]
  segments.push({ id: 'tab:usage', text: `Context ${s.context === undefined ? '—' : `${s.context}%`}`, fg: text, bg, hoverBg: theme.hover })
  if (s.fiveHour !== undefined) {
    segments.push(plain('  ·  ', text, bg))
    segments.push({ id: 'tab:usage', text: `5-hour ${s.fiveHour}%`, fg: text, bg, hoverBg: theme.hover })
  }
  if (s.song !== undefined) {
    segments.push(plain('  ·  ', text, bg))
    segments.push({ id: 'tab:music', text: `♪ ${s.song}`, fg: text, bg, hoverBg: theme.hover })
  }
  return fitRow(segments, cols, bg, text)
}

/** The same segments as plain, non-clickable Text: the fallback when a Client is not available. */
export function segmentsText(els: Els, segments: readonly RowSegment[]) {
  const { Box, Text } = els
  return (
    <Box flexDirection="row">
      {segments.map(seg => (
        <Text color={seg.fg} backgroundColor={seg.bg} bold={seg.bold === true}>
          {seg.text}
        </Text>
      ))}
    </Box>
  )
}

/** A single row of raster text, for places a Client row is not wanted. */
export function textRowCells(text: string, cols: number, fg: number, bg: number): string {
  return wordsToCells(textWords(text, cols, fg, bg))
}
