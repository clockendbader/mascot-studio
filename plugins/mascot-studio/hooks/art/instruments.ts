// Period instruments drawn as Rasters: the Task Manager's LED meter, its
// scrolling history graph (with the mini mascot), and the title bar.

import type { MiniMood } from '../../types'
import { level } from '../usage'
import type { Level } from '../usage'
import { MINI, spriteGrid } from './sprites'
import { drawSprite, gridToCells, newGrid, textWords, wordsToCells } from './pixels'

export const LED_GREEN = 0x00ff00
export const LED_DIM = 0x004000
export const GRID = 0x008040
const BLACK = 0x000000
const WHITE = 0xffffff
const TITLE_FROM = 0x0a246a
const TITLE_TO = 0xa6caf0
const MINI_SIZE = 8

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
  const frames = MINI[mini.mood]
  const frame = frames[mini.tick % frames.length] ?? frames[0]
  const top = Math.min(Math.max(0, pointY - MINI_SIZE), h - MINI_SIZE)
  drawSprite(g, spriteGrid(frame?.rows ?? []), cols - MINI_SIZE, top)
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
