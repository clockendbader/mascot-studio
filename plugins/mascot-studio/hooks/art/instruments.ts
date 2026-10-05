// Period instruments drawn as Rasters: the Task Manager's LED meter, its
// scrolling history graph (with the mini mascot), and the title bar.

import type { Keyframe, MiniMood } from '../../types'
import { level } from '../usage'
import type { Level } from '../usage'
import { drawMiniClawd } from './clawd'
import { TRANSPARENT, gridToCells, newGrid, sanitizeForRaster, textWords, wordsToCells } from './pixels'

export const LED_GREEN = 0x00ff00
export const LED_DIM = 0x004000
export const GRID = 0x008040
const BLACK = 0x000000
const WHITE = 0xffffff
const TITLE_FROM = 0x0a246a
const TITLE_TO = 0xa6caf0
const MINI_SIZE = 8
const MINI_HEIGHT = 4

const LIT: Readonly<Record<Level, number>> = { ok: LED_GREEN, warn: 0xffb000, critical: 0xff3030 }

/** Two columns of LED segments, one per other pixel row, lit from the bottom. */
export function ledMeterCells(pct: number | undefined, cols: number, rows: number): string {
  const h = rows * 2
  const g = newGrid(cols, h, BLACK)
  const segments = Math.floor(h / 2)
  const lit = Math.round(((pct ?? 0) / 100) * segments)
  const mid = Math.floor(cols / 2)
  const on = LIT[level(pct)]
  for (let s = 0; s < segments; s++) {
    const y = h - 1 - s * 2
    for (let x = 1; x < cols - 1; x++) {
      if (x === mid) continue
      g.px[y * cols + x] = s < lit ? on : LED_DIM
    }
  }
  return gridToCells(g)
}

function heightOf(pct: number, h: number): number {
  return Math.round((Math.min(100, Math.max(0, pct)) / 100) * (h - 1))
}

/** The scrolling green graph on a black grid, newest sample at the right, the mini mascot standing on it. */
export function historyCells(samples: readonly number[], cols: number, rows: number, mini: { mood: MiniMood; tick: number }): string {
  const h = rows * 2
  const g = newGrid(cols, h, BLACK)
  for (let x = 0; x < cols; x += 4) for (let y = 0; y < h; y++) g.px[y * cols + x] = GRID
  for (let y = 0; y < h; y += 4) for (let x = 0; x < cols; x++) g.px[y * cols + x] = GRID

  const shown = samples.slice(-cols)
  let previous: number | undefined
  shown.forEach((pct, i) => {
    const x = cols - shown.length + i
    const y = h - 1 - heightOf(pct, h)
    const from = previous ?? y
    for (let yy = Math.min(from, y); yy <= Math.max(from, y); yy++) g.px[yy * cols + x] = LED_GREEN
    previous = y
  })

  const pointY = shown.length === 0 ? h : h - 1 - heightOf(shown[shown.length - 1] ?? 0, h)
  const top = Math.min(Math.max(0, pointY - MINI_HEIGHT), h - MINI_HEIGHT)
  const mood = mini.mood === 'asleep' || mini.mood === 'flat' ? 'asleep' : mini.mood === 'sweat' ? 'sweat' : 'awake'
  drawMiniClawd(g, cols - MINI_SIZE, top, mini.tick, mood)
  return gridToCells(g)
}

function mix(from: number, to: number, t: number): number {
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff
    const b = (to >> shift) & 0xff
    return Math.round(a + (b - a) * t) << shift
  }
  return channel(16) | channel(8) | channel(0)
}

/** One row: the title in white over a navy-to-sky gradient, the window buttons at the right. */
export function titleBarCells(text: string, cols: number): string {
  const buttons = '_□×'
  const label = ` ${text}`.slice(0, Math.max(0, cols - buttons.length - 2))
  const line = label.padEnd(cols - buttons.length - 1) + buttons + ' '
  const at = (i: number) => mix(TITLE_FROM, TITLE_TO, cols <= 1 ? 0 : i / (cols - 1))
  return wordsToCells(textWords(line, cols, WHITE, at))
}

// ── MascotAmp ────────────────────────────────────────────────────────────

const BARS = '▁▂▃▄▅▆▇'
export const VIZ_BARS = 16
const VIZ_MAX = BARS.length - 1
const MARQUEE_GAP = '   '

/** The LCD: green on black, the text looping past `offset` like a marquee. */
export function lcdCells(text: string, cols: number, offset: number): string {
  const loop = [...sanitizeForRaster(text + MARQUEE_GAP)]
  const start = ((offset % loop.length) + loop.length) % loop.length
  let line = ''
  for (let i = 0; i < cols; i++) line += loop[(start + i) % loop.length] ?? ' '
  return wordsToCells(textWords(line, cols, LED_GREEN, BLACK))
}

/** The spectrum's bars, always VIZ_BARS wide: a missing value is a flat bar. */
export function visualizerCells(heights: readonly number[]): string {
  const bars = Array.from({ length: VIZ_BARS }, (_, i) => BARS[Math.min(VIZ_MAX, Math.max(0, Math.round(heights[i] ?? 0)))] ?? BARS[0]).join('')
  return wordsToCells(textWords(bars, VIZ_BARS, LED_GREEN, BLACK))
}

/** The decorative spectrum's next step: a random walk while playing, flat otherwise. */
export function nextHeights(prev: readonly number[], playing: boolean, rand: () => number): number[] {
  return Array.from({ length: VIZ_BARS }, (_, i) =>
    playing ? Math.min(VIZ_MAX, Math.max(0, (prev[i] ?? 0) + Math.round(rand() * 4) - 2)) : 0,
  )
}

const DJ_PALETTE: Readonly<Record<string, number>> = { z: 0x000000, d: 0x7a3fa0, D: 0xa060c8, k: 0x1a1a1a }
const DJ_UP = ['..zzzzzz..', '.z......z.', 'zz.dddd.zz', 'zzdddddDzz', '.ddkddkdd.', '.dddddddd.', '.ddDkkDdd.', '.dddddddd.', '..dddddd..', '..k....k..']
const DJ_SQUASH = ['..........', '..zzzzzz..', '.z......z.', 'zzddddddzz', 'zddkddkddz', 'dddddddddd', '.ddDkkDdd.', '.dddddddd.', '.dddddddd.', '.k......k.']
const withRows = (base: readonly string[], changes: Readonly<Record<number, string>>) => base.map((row, i) => changes[i] ?? row)
const DJ: Readonly<Record<'dance' | 'sway' | 'doze', readonly (readonly string[])[]>> = {
  dance: [DJ_UP, DJ_SQUASH, withRows(DJ_UP, { 5: 'kddddddddk', 9: '...k..k...' }), withRows(DJ_SQUASH, { 9: 'k........k' })],
  sway: [DJ_UP, withRows(DJ_UP, { 9: '...k..k...' })],
  doze: [withRows(DJ_UP, { 4: '.dkkddkkd.' }), withRows(DJ_UP, { 1: '.z......zk', 4: '.dkkddkkd.' })],
}

function paletteGrid(rows: readonly string[], palette: Readonly<Record<string, number>>) {
  const g = newGrid(rows[0]?.length ?? 0, rows.length, TRANSPARENT)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (g.px[y * g.w + x] = palette[ch] ?? TRANSPARENT)))
  return g
}

/** The DJ blob, 10x10 px: dancing while music plays, swaying when paused, dozing otherwise. */
export function djCells(mode: 'dance' | 'sway' | 'doze', tick: number): string {
  const frames = DJ[mode]
  return gridToCells(paletteGrid(frames[tick % frames.length] ?? frames[0] ?? [], DJ_PALETTE))
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

const rgb = (hexColor: string) => parseInt(hexColor.slice(1), 16)

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
    const film = rgb(isPlayhead ? colors.playhead : x % 3 === 1 ? colors.hole : colors.film)
    const middle = rgb(isPlayhead ? colors.playhead : onClip ? clip.color : colors.gap)
    words.set([0x2580, film, middle], x * 3)
    words.set([0x2580, middle, film], (width + x) * 3)
  }
  return wordsToCells(words)
}
