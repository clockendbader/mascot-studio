import type { Hat, Pose, ThemeName } from '../types'
import { VIZ_BARS, djCells, historyCells, lcdCells, visualizerCells } from './art/instruments'
import { screensaverCells, screensaverKindAt } from './art/screensavers'
import { STAGE_ROWS, stageCells } from './art/stage'
import { THEMES } from './themes'

export const TICK_MS = 166
const SCREENSAVER_TURN_MS = 60_000
const ASLEEP_AFTER_MS = 60_000

export type RasterKey = 'stage' | 'ctx-graph' | 'lcd' | 'viz' | 'dj'
export type RasterFrame = { key: RasterKey; columns: number; rows: number; cells: string }

/** The Usage tab's context history graph. */
export type UsageAnim = { graphCols: number; samples: number[]; colors: { bg: number; grid: number; line: number } }

export type AmpAnim = {
  lcdCols: number
  /** The LCD text, or null when an explanation replaces the LCD. */
  marquee: string | null
  mode: 'dance' | 'sway' | 'doze'
  heights: number[]
}

export type AnimModel = {
  /** `screensaver.since`: when the screensaver started; which one shows and how far it has run follow from the clock. */
  stage?: { cols: number; pose: Pose; hat: Hat; theme: ThemeName; idleSince: number | null; screensaver: { since: number } | null }
  usage?: UsageAnim
  amp?: AmpAnim
}

/** Every raster the pane shows, drawn for one animation tick. */
export function rasterFrames(m: AnimModel, tick: number, now: number): RasterFrame[] {
  const frames: RasterFrame[] = []
  if (m.stage !== undefined) {
    const { cols, hat, screensaver, idleSince } = m.stage
    const isAsleep = m.stage.pose === 'idle' && idleSince !== null && now - idleSince >= ASLEEP_AFTER_MS
    const pose: Pose = isAsleep ? 'asleep' : m.stage.pose
    const backdrop = THEMES[m.stage.theme].backdrop
    if (screensaver === null) {
      frames.push({ key: 'stage', columns: cols, rows: STAGE_ROWS, cells: stageCells({ cols, pose, hat, tick, backdrop }) })
    } else {
      const running = Math.max(0, now - screensaver.since)
      const kind = screensaverKindAt(running)
      const local = Math.floor((running % SCREENSAVER_TURN_MS) / TICK_MS)
      const seed = screensaver.since + Math.floor(running / SCREENSAVER_TURN_MS)
      frames.push({ key: 'stage', columns: cols, rows: STAGE_ROWS, cells: screensaverCells(kind, cols, STAGE_ROWS, local, seed) })
    }
  }
  if (m.usage !== undefined) {
    const u = m.usage
    frames.push({ key: 'ctx-graph', columns: u.graphCols, rows: 2, cells: historyCells(u.samples, u.graphCols, 2, u.colors) })
  }
  if (m.amp !== undefined) {
    const amp = m.amp
    frames.push({ key: 'dj', columns: 10, rows: 5, cells: djCells(amp.mode, tick) })
    if (amp.marquee !== null) frames.push({ key: 'lcd', columns: amp.lcdCols, rows: 1, cells: lcdCells(amp.marquee, amp.lcdCols, Math.floor(tick / 2)) })
    frames.push({ key: 'viz', columns: VIZ_BARS, rows: 1, cells: visualizerCells(amp.heights) })
  }
  return frames
}
