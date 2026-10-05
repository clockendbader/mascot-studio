// Instruments drawn as Rasters: the Usage tab's history graph, the Music
// tab's DJ blob and progress row, and the Timeline's film strip fallback.

import type { Keyframe, Progress } from '../../types'
import type { Theme } from '../themes'
import { TRANSPARENT, gridToCells, newGrid, wordsToCells } from './pixels'

export const LED_GREEN = 0x00ff00
export const GRID = 0x008040
const BLACK = 0x000000

function heightOf(pct: number, h: number): number {
  return Math.round((Math.min(100, Math.max(0, pct)) / 100) * (h - 1))
}

export type GraphColors = { bg: number; grid: number; line: number }
const TASK_MANAGER: GraphColors = { bg: BLACK, grid: GRID, line: LED_GREEN }

/** The scrolling graph on its grid, newest sample at the right (green on black unless themed). */
export function historyCells(
  samples: readonly number[],
  cols: number,
  rows: number,
  colors: GraphColors = TASK_MANAGER,
): string {
  const h = rows * 2
  const g = newGrid(cols, h, colors.bg)
  for (let x = 0; x < cols; x += 4) for (let y = 0; y < h; y++) g.px[y * cols + x] = colors.grid
  for (let y = 0; y < h; y += 4) for (let x = 0; x < cols; x++) g.px[y * cols + x] = colors.grid

  const shown = samples.slice(-cols)
  let previous: number | undefined
  shown.forEach((pct, i) => {
    const x = cols - shown.length + i
    const y = h - 1 - heightOf(pct, h)
    const from = previous ?? y
    for (let yy = Math.min(from, y); yy <= Math.max(from, y); yy++) g.px[yy * cols + x] = colors.line
    previous = y
  })

  return gridToCells(g)
}

// ── Music ────────────────────────────────────────────────────────────────

/** A progress row with its player's clock: the position as of `at` (ms on the plugin's clock). */
export type ProgressAt = Progress & { at: number }

/** Seconds as m:ss, or h:mm:ss from an hour. */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const BAR = 0x2501
const SPACE = 0x20
const hex = (color: string) => parseInt(color.slice(1), 16)

/**
 * The Music tab's progress row, one raster row `cols` wide: the time played, the bar and the
 * track's length. While playing, the position moves on from `p.at` with the clock; it never
 * runs past the end. Without progress the row is a bare bar in the track colour.
 */
export function progressCells(p: ProgressAt | null, playing: boolean, now: number, cols: number, theme: Theme): string {
  const { bg, soft, progress, track } = theme.music
  const back = hex(bg)
  const words = new Uint32Array(cols * 3)
  let x = 0
  const put = (cp: number, fg: number) => {
    if (x < cols) words.set([cp, fg, back], 3 * x++)
  }
  const write = (text: string, fg: number) => {
    for (const ch of text) put(ch.codePointAt(0) ?? SPACE, fg)
  }
  if (p === null) {
    while (x < cols) put(BAR, hex(track))
    return wordsToCells(words)
  }
  const position = Math.min(p.duration, Math.max(0, p.position + (playing ? (now - p.at) / 1000 : 0)))
  const played = clockText(position)
  const length = clockText(p.duration)
  const barCols = cols - played.length - length.length - 2
  if (barCols < 4) {
    write(`${played}/${length}`, hex(soft))
  } else {
    const lit = Math.round((position / p.duration) * barCols)
    write(`${played} `, hex(soft))
    for (let i = 0; i < barCols; i++) put(BAR, hex(i < lit ? progress : track))
    write(` ${length}`, hex(soft))
  }
  while (x < cols) put(SPACE, hex(soft))
  return wordsToCells(words)
}

const DJ_PALETTE: Readonly<Record<string, number>> = { z: 0xb8c2cc, d: 0x7a3fa0, D: 0xa060c8, k: 0x1a1a1a }
const DJ_UP = ['..zzzzzz..', '.z......z.', 'zz.dddd.zz', 'zzdddddDzz', '.ddkddkdd.', '.dddddddd.', '.ddDkkDdd.', '.dddddddd.', '..dddddd..', '..k....k..']
const DJ_SQUASH = ['..........', '..zzzzzz..', '.z......z.', 'zzddddddzz', 'zddkddkddz', 'dddddddddd', '.ddDkkDdd.', '.dddddddd.', '.dddddddd.', '.k......k.']
const withRows = (base: readonly string[], changes: Readonly<Record<number, string>>) => base.map((row, i) => changes[i] ?? row)
const DJ: Readonly<Record<'dance' | 'sway' | 'doze', readonly (readonly string[])[]>> = {
  dance: [DJ_UP, DJ_SQUASH, withRows(DJ_UP, { 5: 'kddddddddk', 9: '...k..k...' }), withRows(DJ_SQUASH, { 9: 'k........k' })],
  sway: [DJ_UP, withRows(DJ_UP, { 9: '...k..k...' })],
  doze: [withRows(DJ_UP, { 4: '.dkkddkkd.' }), withRows(DJ_UP, { 1: '.z......zk', 4: '.dkkddkkd.' })],
}

function paletteGrid(rows: readonly string[], palette: Readonly<Record<string, number>>, bg: number) {
  const g = newGrid(rows[0]?.length ?? 0, rows.length, bg)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (g.px[y * g.w + x] = palette[ch] ?? bg)))
  return g
}

/** The DJ blob, 10x10 px on `bg` (0xRRGGBB): dancing while music plays, swaying when paused, dozing otherwise. */
export function djCells(mode: 'dance' | 'sway' | 'doze', tick: number, bg: number = TRANSPARENT): string {
  const frames = DJ[mode]
  return gridToCells(paletteGrid(frames[tick % frames.length] ?? frames[0] ?? [], DJ_PALETTE, bg))
}

// ── Timeline film strip ──────────────────────────────────────────────────

const CLIP_COLORS: Readonly<Record<string, string>> = {
  reading: '#4A90E2',
  coding: '#D97757',
  terminal: '#4B5563',
  browsing: '#2EAD6B',
  helper: '#8E5CD9',
}
export const CLIP_FAILED = '#E5484D'

/** A step's clip colour: what kind of work it was, or red when it failed. */
export function clipColor(frame: Keyframe): string {
  if (frame.isError === true) return CLIP_FAILED
  return CLIP_COLORS[frame.pose] ?? CLIP_COLORS.coding ?? '#D97757'
}


/** The film strip as a plain two-row Raster: what the Timeline draws when its Client is not available. */
export function filmstripCells(
  clips: readonly { n: number; color: string }[],
  current: number,
  width: number,
  colors: { film: string; hole: string; gap: string; playhead: string },
): string {
  const words = new Uint32Array(width * 2 * 3)
  for (let x = 0; x < width; x++) {
    const i = x < 1 ? -1 : Math.floor((x - 1) / 2)
    const clip = i >= 0 ? clips[i] : undefined
    const onClip = clip !== undefined && (x - 1) % 2 === 0
    const isPlayhead = clip !== undefined && clip.n === current && !onClip
    const film = hex(isPlayhead ? colors.playhead : x % 3 === 1 ? colors.hole : colors.film)
    const middle = hex(isPlayhead ? colors.playhead : onClip ? clip.color : colors.gap)
    words.set([0x2580, film, middle], x * 3)
    words.set([0x2580, middle, film], (width + x) * 3)
  }
  return wordsToCells(words)
}
