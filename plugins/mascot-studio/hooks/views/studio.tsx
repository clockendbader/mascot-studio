import type { Elements } from 'claude-code'

import type { Activity, Keyframe, Pose, Scene } from '../../types'
import { truncateMiddle } from '../activity'
import type { RasterFrame } from '../animator'
import type { Layout } from '../layout'
import { taskManagerView } from './taskManager'
import type { TaskManagerVM } from './taskManager'
import { timelineView } from './timeline'
import type { TimelineActions } from './timeline'

type Els = Elements['terminal']

export type StudioVM = {
  cols: number
  layout: Layout
  scene: Scene
  keyframes: readonly Keyframe[]
  soundFrames: readonly number[]
  current: number
  selected: Keyframe | null
  activity: Activity
  elapsed: string
  visitors: number | null
  frames: Readonly<Partial<Record<string, RasterFrame>>>
  tm?: TaskManagerVM
}

export type StudioActions = TimelineActions & {
  live(): void
}

const MENU = ' File  Edit  View  Insert  Modify  Control'

const POSE_WORDS: Readonly<Record<Pose, string>> = {
  thinking: 'thinking',
  magnify: 'magnifier',
  tablet: 'pen tablet',
  keyboard: 'keyboard',
  browser: 'browser',
  helper: 'calling a helper',
  facepalm: 'facepalm',
  wave: 'waving',
  hop: 'export movie',
  asleep: 'asleep',
}

function duration(frame: Keyframe): string {
  if (frame.durationMs === undefined) return '…'
  return frame.durationMs < 1000 ? `${frame.durationMs} ms` : `${(frame.durationMs / 1000).toFixed(1)} s`
}

function outcome(frame: Keyframe): string {
  if (frame.durationMs === undefined) return `… running`
  return `${frame.isError === true ? '✖' : '✓'} ${duration(frame)}${frame.errorLine ? ` ${frame.errorLine}` : ''}`
}

function separator(els: Els, name: string, cols: number) {
  const { Text } = els
  return <Text dimColor wrap="truncate-end">{`┄ ${name} `.padEnd(cols, '┄')}</Text>
}

function rasterOf(els: Els, frame: RasterFrame | undefined) {
  const { Raster } = els
  return frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
}

function propertiesView(els: Els, vm: StudioVM, act: StudioActions) {
  const { Box, Text, Button } = els
  const { cols, activity, selected } = vm
  const isLine = vm.layout.props === 'line'

  if (selected !== null) {
    const summary = `Frame ${selected.n} · ${selected.tool} · ${outcome(selected)}`
    const live = <Button key="live" plain hotkey="l" label="live" onPress={() => act.live()} />
    if (isLine) {
      return (
        <Box flexDirection="row">
          {live}
          <Text wrap="truncate-end">{` ${summary} · ${selected.target}`}</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Text wrap="truncate-end">{` ${summary}`}</Text>
        <Box flexDirection="row">
          <Text>{' '}</Text>
          {live}
          <Text wrap="truncate-end">{`  ${truncateMiddle(selected.target, Math.max(1, cols - 10))}`}</Text>
        </Box>
      </Box>
    )
  }

  const tool = activity.tool ?? '—'
  const words = POSE_WORDS[activity.pose]
  const target = activity.target ?? ''
  if (isLine) return <Text wrap="truncate-end">{` ${tool} · Pose ${words} · ${target}`}</Text>
  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">{` Tool    ${tool.padEnd(16)}Pose  ${words}`}</Text>
      <Text wrap="truncate-end">{` Target  ${truncateMiddle(target, Math.max(1, cols - 9))}`}</Text>
    </Box>
  )
}

/** The whole pane: menu bar, timeline, stage (or Scene 2) and Properties. */
export function studioView(els: Els, vm: StudioVM, act: StudioActions) {
  const { Box, Text } = els
  const { cols, layout } = vm
  if (layout.tooNarrow) return <Text>Widen the pane to see the studio.</Text>

  return (
    <Box flexDirection="column" width={cols}>
      {layout.menu ? (
        <Box key="menu-bar">
          <Text dimColor wrap="truncate-end">{MENU}</Text>
        </Box>
      ) : null}
      <Box key="timeline-section" flexDirection="column">
        {separator(els, 'Timeline', cols)}
        {timelineView(els, vm, act)}
      </Box>
      {vm.scene === 1 ? (
        <Box key="stage-section" flexDirection="column">
          {separator(els, 'Stage', cols)}
          {rasterOf(els, vm.frames.stage)}
        </Box>
      ) : (
        <Box key="stage-section" flexDirection="column">
          {separator(els, 'Stage · Scene 2: Task Manager', cols)}
          {vm.tm === undefined ? null : taskManagerView(els, vm.tm, vm.frames)}
        </Box>
      )}
      <Box key="properties-section" flexDirection="column">
        {separator(els, 'Properties', cols)}
        {propertiesView(els, vm, act)}
      </Box>
    </Box>
  )
}
