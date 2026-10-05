import type { Hat, Pose } from '../types'
import { STAGE_ROWS, stageCells } from './art/stage'

export type RasterKey = 'stage' | 'tm-title' | 'ctx-meter' | 'ctx-graph' | 'lcd' | 'viz' | 'dj'
export type RasterFrame = { key: RasterKey; columns: number; rows: number; cells: string }

export type AnimModel = {
  stage?: { cols: number; pose: Pose; hat: Hat; screensaver: null }
}

/** Every raster the pane shows, drawn for one animation tick. */
export function rasterFrames(m: AnimModel, tick: number, _now: number): RasterFrame[] {
  const frames: RasterFrame[] = []
  if (m.stage !== undefined) {
    const { cols, pose, hat } = m.stage
    frames.push({ key: 'stage', columns: cols, rows: STAGE_ROWS, cells: stageCells({ cols, rows: STAGE_ROWS, pose, hat, tick }) })
  }
  return frames
}
