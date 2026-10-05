import { test, expect, describe } from 'claude-code/testing'
import { historyCells, GRID, LED_GREEN } from '../hooks/art/instruments'
import { rasterFrames } from '../hooks/animator'
import { cellAt, decode } from './cells'

/** Pixel (x, y) of a half-block raster: the top pixel is a cell's foreground, the bottom its background. */
function pixel(cells: string, cols: number, x: number, y: number): number {
  const [, fg, bg] = cellAt(cells, cols, x, Math.floor(y / 2))
  return (y % 2 === 0 ? fg : bg) ?? -1
}

function rowColors(cells: string, cols: number, row: number): number[] {
  const out: number[] = []
  for (let col = 0; col < cols; col++) out.push(...cellAt(cells, cols, col, row).slice(1))
  return out
}


describe('historyCells', () => {
  const cols = 30

  test('draws a grid on black', () => {
    const cells = historyCells([], cols, 5)
    expect(pixel(cells, cols, 1, 1)).toBe(0x000000)
    expect(pixel(cells, cols, 4, 1)).toBe(GRID)
  })

  test('plots the newest sample in the rightmost column', () => {
    const cells = historyCells([60, 0], cols, 5)
    expect(pixel(cells, cols, cols - 1, 9)).toBe(LED_GREEN)
  })

})



describe('rasterFrames for the Usage tab', () => {
  test('draws the themed history graph, two rows tall', () => {
    const usage = { graphCols: 30, samples: [10, 20], colors: { bg: 0x1e1e1e, grid: 0x3a3a3a, line: 0x3d8be8 } }
    const frames = rasterFrames({ usage }, 0, 0)
    expect(frames.map(f => [f.key, f.columns, f.rows])).toEqual([['ctx-graph', 30, 2]])
    expect(decode(frames[0]?.cells ?? '')).toContain(0x3d8be8)
  })
})
