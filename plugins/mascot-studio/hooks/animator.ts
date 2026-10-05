import type { Hat, Pose } from '../types'
import { VIZ_BARS, djCells, historyCells, lcdCells, ledMeterCells, titleBarCells, visualizerCells } from './art/instruments'
import { STAGE_ROWS, stageCells } from './art/stage'
import { miniMood } from './usage'

export type RasterKey = 'stage' | 'tm-title' | 'ctx-meter' | 'ctx-graph' | 'lcd' | 'viz' | 'dj'
export type RasterFrame = { key: RasterKey; columns: number; rows: number; cells: string }

export type TaskManagerAnim = {
  meterCols: number
  meterRows: number
  graphCols: number
  graphRows: number
  titleCols: number
  samples: number[]
  pct?: number
  highest?: number
  idleSince: number | null
  title: string
}

export type AmpAnim = {
  lcdCols: number
  /** The LCD text, or null when an explanation replaces the LCD. */
  marquee: string | null
  mode: 'dance' | 'sway' | 'doze'
  heights: number[]
}

export type AnimModel = {
  stage?: { cols: number; pose: Pose; hat: Hat; screensaver: null }
  tm?: TaskManagerAnim
  amp?: AmpAnim
}

/** Every raster the pane shows, drawn for one animation tick. */
export function rasterFrames(m: AnimModel, tick: number, now: number): RasterFrame[] {
  const frames: RasterFrame[] = []
  if (m.stage !== undefined) {
    const { cols, pose, hat } = m.stage
    frames.push({ key: 'stage', columns: cols, rows: STAGE_ROWS, cells: stageCells({ cols, rows: STAGE_ROWS, pose, hat, tick }) })
  }
  if (m.tm !== undefined) {
    const tm = m.tm
    const mood = miniMood(tm.highest, tm.idleSince === null ? 0 : now - tm.idleSince)
    frames.push(
      { key: 'tm-title', columns: tm.titleCols, rows: 1, cells: titleBarCells(tm.title, tm.titleCols) },
      { key: 'ctx-meter', columns: tm.meterCols, rows: tm.meterRows, cells: ledMeterCells(tm.pct, tm.meterCols, tm.meterRows) },
      { key: 'ctx-graph', columns: tm.graphCols, rows: tm.graphRows, cells: historyCells(tm.samples, tm.graphCols, tm.graphRows, { mood, tick }) },
    )
  }
  if (m.amp !== undefined) {
    const amp = m.amp
    frames.push({ key: 'dj', columns: 10, rows: 5, cells: djCells(amp.mode, tick) })
    if (amp.marquee !== null) frames.push({ key: 'lcd', columns: amp.lcdCols, rows: 1, cells: lcdCells(amp.marquee, amp.lcdCols, Math.floor(tick / 2)) })
    frames.push({ key: 'viz', columns: VIZ_BARS, rows: 1, cells: visualizerCells(amp.heights) })
  }
  return frames
}
