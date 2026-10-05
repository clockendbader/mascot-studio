import type { Hat, Pose } from '../../types'
import { composeMascot } from './sprites'
import { drawSprite, fillRect, gridToCells, newGrid } from './pixels'

export const STAGE_ROWS = 12
export const WORK_AREA = 0x9a9a9a
export const CANVAS = 0xffffff
const SHADOW = 0x666666
const MAX_CANVAS = 40
const SPRITE = 24

export type StageOptions = { cols: number; rows: number; pose: Pose; hat: Hat; tick: number }

/** The Stage: a white canvas with a drop shadow on the grey work area, the mascot standing on it. */
export function stageCells(o: StageOptions): string {
  const h = o.rows * 2
  const g = newGrid(o.cols, h, WORK_AREA)
  const cw = Math.min(o.cols, MAX_CANVAS)
  const x0 = Math.floor((o.cols - cw) / 2)
  fillRect(g, x0 + 1, 2, cw, h - 2, SHADOW)
  fillRect(g, x0, 1, cw, h - 2, CANVAS)
  const bottom = h - 2
  drawSprite(g, composeMascot(o.pose, o.hat, o.tick), x0 + Math.floor((cw - SPRITE) / 2), bottom - SPRITE + 1)
  return gridToCells(g)
}
