import { test, expect, describe } from 'claude-code/testing'
import { historyCells, ledMeterCells, titleBarCells, GRID, LED_GREEN } from '../hooks/art/instruments'
import { rasterFrames } from '../hooks/animator'
import { PALETTE } from '../hooks/art/sprites'
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

describe('ledMeterCells', () => {
  test('lights nothing at 0%', () => {
    expect(decode(ledMeterCells(0, 7, 4))).not.toContain(LED_GREEN)
  })

  test('lights from the bottom up', () => {
    const cells = ledMeterCells(50, 7, 4)
    expect([...rowColors(cells, 7, 2), ...rowColors(cells, 7, 3)]).toContain(LED_GREEN)
    expect([...rowColors(cells, 7, 0), ...rowColors(cells, 7, 1)]).not.toContain(LED_GREEN)
  })

  test('turns amber at 85% and red at 97%', () => {
    expect(decode(ledMeterCells(85, 7, 4))).toContain(0xffb000)
    expect(decode(ledMeterCells(97, 7, 4))).toContain(0xff3030)
    expect(decode(ledMeterCells(97, 7, 4))).not.toContain(LED_GREEN)
  })

  test('shows an unlit meter when the figure is missing', () => {
    expect(decode(ledMeterCells(undefined, 7, 4))).not.toContain(LED_GREEN)
  })
})

describe('historyCells', () => {
  const cols = 30
  const relaxed = { mood: 'relaxed' as const, tick: 0 }

  test('draws a grid on black', () => {
    const cells = historyCells([], cols, 5, relaxed)
    expect(pixel(cells, cols, 1, 1)).toBe(0x000000)
    expect(pixel(cells, cols, 4, 1)).toBe(GRID)
  })

  test('plots the newest sample in the rightmost column', () => {
    const cells = historyCells([60, 0], cols, 5, relaxed)
    expect(pixel(cells, cols, cols - 1, 9)).toBe(LED_GREEN)
  })

  test('stands the mini mascot on the newest point', () => {
    const cells = historyCells([0], cols, 5, relaxed)
    const fur = PALETTE.g
    let found = false
    for (let x = cols - 8; x < cols; x++) for (let y = 0; y < 9; y++) if (pixel(cells, cols, x, y) === fur) found = true
    expect(found).toBe(true)
    expect(pixel(cells, cols, cols - 1, 9)).toBe(LED_GREEN)
  })
})

describe('titleBarCells', () => {
  test('writes the title in white over a navy-to-sky gradient', () => {
    const cells = titleBarCells('Task Manager', 40)
    expect(cellAt(cells, 40, 1, 0).slice(0, 2)).toEqual(['T'.codePointAt(0), 0xffffff])
    expect(cellAt(cells, 40, 0, 0)[2]).toBe(0x0a246a)
    expect(cellAt(cells, 40, 39, 0)[2]).toBe(0xa6caf0)
  })

  test('keeps only characters a raster can hold', () => {
    const cells = titleBarCells('日本', 10)
    expect(cellAt(cells, 10, 1, 0)[0]).toBe('?'.codePointAt(0))
  })
})

describe('rasterFrames for Scene 2', () => {
  const tm = { meterCols: 7, meterRows: 4, graphCols: 30, graphRows: 5, titleCols: 40, samples: [10, 20], pct: 20, highest: 20, idleSince: 0, title: 'Task Manager' } as const

  test('draws the title bar, the meter and the graph', () => {
    const frames = rasterFrames({ tm: { ...tm, samples: [...tm.samples] } }, 0, 1000)
    expect(frames.map(f => [f.key, f.columns, f.rows])).toEqual([
      ['tm-title', 40, 1],
      ['ctx-meter', 7, 4],
      ['ctx-graph', 30, 5],
    ])
  })

  test('puts the mini mascot to sleep after a quiet minute without a redraw', () => {
    const at = (now: number) => rasterFrames({ tm: { ...tm, samples: [...tm.samples] } }, 0, now).find(f => f.key === 'ctx-graph')?.cells
    expect(at(1000)).not.toBe(at(61000))
  })
})
