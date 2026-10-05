import type { Hat, Pose, ThemeName } from '../types'
import { djCells, historyCells, progressCells } from './art/instruments'
import type { ProgressAt } from './art/instruments'
import { screensaverCells, screensaverKindAt } from './art/screensavers'
import { STAGE_ROWS, stageCells } from './art/stage'
import { THEMES } from './themes'

export const TICK_MS = 166
const SCREENSAVER_TURN_MS = 60_000
const ASLEEP_AFTER_MS = 60_000

export type RasterKey = 'stage' | 'ctx-graph' | 'dj' | 'progress'
export type RasterFrame = { key: RasterKey; columns: number; rows: number; cells: string }

/** The Usage tab's context history graph. */
export type UsageAnim = { graphCols: number; samples: number[]; colors: { bg: number; grid: number; line: number } }

/** The Music tab: the DJ blob (when the tab is tall enough) and the song's progress row (when a song shows). */
export type MusicAnim = {
  theme: ThemeName
  dj: boolean
  mode: 'dance' | 'sway' | 'doze'
  /** `value` is the player's last report; the ticker swaps in the newest one each tick. */
  progress: { cols: number; playing: boolean; value: ProgressAt | null } | null
}

export type AnimModel = {
  /** `screensaver.since`: when the screensaver started; which one shows and how far it has run follow from the clock. */
  stage?: { cols: number; pose: Pose; hat: Hat; theme: ThemeName; idleSince: number | null; screensaver: { since: number } | null }
  usage?: UsageAnim
  music?: MusicAnim
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
  if (m.music !== undefined) {
    const { dj, mode, progress } = m.music
    const theme = THEMES[m.music.theme]
    if (dj) frames.push({ key: 'dj', columns: 10, rows: 5, cells: djCells(mode, tick, parseInt(theme.music.bg.slice(1), 16)) })
    if (progress !== null) {
      frames.push({ key: 'progress', columns: progress.cols, rows: 1, cells: progressCells(progress.value, progress.playing, now, progress.cols, theme) })
    }
  }
  return frames
}
