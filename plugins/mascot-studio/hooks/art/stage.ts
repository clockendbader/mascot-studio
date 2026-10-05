import type { Hat, Pose } from '../../types'
import { SCENE_H, SCENE_W, sceneFrame } from './scene'
import { drawSprite, gridToCells, newGrid } from './pixels'

export const STAGE_ROWS = 12
const DESK_TOP = 19
const DESK = 0xc8b39a
const DESK_EDGE = 0x9c8569

export type StageOptions = {
  cols: number
  pose: Pose
  hat: Hat
  tick: number
  /** The theme's backdrop colour at scene pixel (x, y). */
  backdrop: (x: number, y: number) => number
}

/** The Stage: the theme's backdrop, the desk across the full width, and the scene centred (or clipped on the right when narrow). */
export function stageCells(o: StageOptions): string {
  const g = newGrid(o.cols, SCENE_H, 0)
  const x0 = o.cols >= SCENE_W + 2 ? Math.floor((o.cols - SCENE_W) / 2) : 1
  for (let y = 0; y < SCENE_H; y++) {
    for (let x = 0; x < o.cols; x++) {
      const sceneX = Math.min(SCENE_W - 1, Math.max(0, x - x0))
      g.px[y * o.cols + x] = y === DESK_TOP ? DESK : y === DESK_TOP + 1 ? DESK_EDGE : o.backdrop(sceneX, y)
    }
  }
  drawSprite(g, sceneFrame(o.pose, o.hat, o.tick), x0, 0)
  return gridToCells(g)
}
