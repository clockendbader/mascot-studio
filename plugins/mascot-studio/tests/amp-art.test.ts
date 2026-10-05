import { test, expect } from 'claude-code/testing'
import { djCells, lcdCells, nextHeights, visualizerCells, LED_GREEN } from '../hooks/art/instruments'
import { sanitizeForRaster } from '../hooks/art/pixels'
import { decode } from './cells'

function codePoints(cells: string): number[] {
  return decode(cells).filter((_, i) => i % 3 === 0)
}

test('the LCD shows only characters a raster can hold, green on black', () => {
  const cells = lcdCells('*** 日本語 🎵 ***', 20, 0)
  const points = codePoints(cells)
  expect(points).toHaveLength(20)
  for (const cp of points) expect(sanitizeForRaster(String.fromCodePoint(cp))).toBe(String.fromCodePoint(cp))
  expect(decode(cells).slice(1, 3)).toEqual([LED_GREEN, 0x000000])
})

test('the LCD marquee scrolls and wraps around', () => {
  const text = '*** One More Time - Daft Punk ***'
  expect(lcdCells(text, 20, 1)).not.toBe(lcdCells(text, 20, 0))
  const loop = [...text].length + 3
  expect(lcdCells(text, 20, loop)).toBe(lcdCells(text, 20, 0))
})

test('the visualizer lies flat when nothing plays', () => {
  expect(nextHeights([3, 4, 5], false, () => 0.9)).toEqual(Array(16).fill(0))
})

test('the visualizer moves at most two steps a tick within 0 to 6', () => {
  let heights = Array(16).fill(3)
  let seed = 1
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 50; i++) {
    const next = nextHeights(heights, true, rand)
    expect(next).toHaveLength(16)
    next.forEach((h, j) => {
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(6)
      expect(Math.abs(h - (heights[j] ?? 0))).toBeLessThanOrEqual(2)
    })
    heights = next
  }
})

test('the visualizer draws one bar glyph per value', () => {
  const points = codePoints(visualizerCells([0, 6, 3])).slice(0, 3)
  expect(points.map(cp => String.fromCodePoint(cp)).join('')).toBe('▁▇▄')
})

test('the DJ blob is 10 by 5 cells and dances', () => {
  expect(decode(djCells('dance', 0))).toHaveLength(10 * 5 * 3)
  expect(djCells('dance', 0)).not.toBe(djCells('dance', 1))
})

test('the visualizer always fills its 16 columns, even before the first tick', () => {
  expect(codePoints(visualizerCells([]))).toHaveLength(16)
})
