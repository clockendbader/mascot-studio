import { test, expect, describe } from 'claude-code/testing'
import { stageCells, STAGE_ROWS, WORK_AREA, CANVAS } from '../hooks/art/stage'
import { rasterFrames } from '../hooks/animator'
import { cellAt, decode } from './cells'

const base = { rows: STAGE_ROWS, pose: 'tablet' as const, hat: 'beanie' as const, tick: 0 }

function column(cells: string, cols: number, col: number): number[] {
  const colors: number[] = []
  for (let row = 0; row < STAGE_ROWS; row++) {
    const [, fg, bg] = cellAt(cells, cols, col, row)
    colors.push(fg ?? -1, bg ?? -1)
  }
  return colors
}

describe('stageCells', () => {
  test('fills the whole raster', () => {
    expect(decode(stageCells({ ...base, cols: 46 }))).toHaveLength(46 * 12 * 3)
  })

  test('shows the grey work area at the edges of a wide stage', () => {
    expect(new Set(column(stageCells({ ...base, cols: 46 }), 46, 0))).toEqual(new Set([WORK_AREA]))
  })

  test('shows the white canvas in the middle', () => {
    expect(column(stageCells({ ...base, cols: 46 }), 46, 23)).toContain(CANVAS)
  })

  test('lets the canvas fill a narrow stage', () => {
    const cells = stageCells({ ...base, cols: 24 })
    for (let col = 0; col < 24; col++) expect(column(cells, 24, col).every(c => c === WORK_AREA)).toBe(false)
  })

  test('animates the pose from tick to tick', () => {
    expect(stageCells({ ...base, cols: 46, tick: 0 })).not.toBe(stageCells({ ...base, cols: 46, tick: 1 }))
  })
})

test('rasterFrames draws one stage raster for the studio scene', () => {
  const frames = rasterFrames({ stage: { cols: 46, pose: 'tablet', hat: 'beanie', screensaver: null } }, 0, 0)
  expect(frames).toHaveLength(1)
  expect(frames[0]).toMatchObject({ key: 'stage', columns: 46, rows: 12 })
  expect(frames[0]?.cells).toBe(stageCells({ ...base, cols: 46 }))
})
