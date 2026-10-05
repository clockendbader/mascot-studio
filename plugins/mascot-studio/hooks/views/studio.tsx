import type { Elements } from 'claude-code'

import type { Elements as AllElements } from 'claude-code'

import type { Activity, Dialog, Keyframe, Pose, Tab } from '../../types'
import { truncateMiddle } from '../activity'
import type { RasterFrame } from '../animator'
import type { LayoutV2 } from '../layout'
import type { Theme } from '../themes'
import { chromeCells } from './chrome'
import { dialogView } from './dialogs'
import { mascotAmpView } from './mascotAmp'
import type { AmpActions, AmpVM } from './mascotAmp'
import { taskManagerView } from './taskManager'
import type { TaskManagerVM } from './taskManager'
import { timelineView } from './timeline'
import type { TimelineActions } from './timeline'

type Els = Elements['terminal']

type Tree = ReturnType<AllElements['terminal']['Box']>

export type StudioVM = {
  cols: number
  layout: LayoutV2
  theme: Theme
  tab: Tab
  keyframes: readonly Keyframe[]
  soundFrames: readonly number[]
  current: number
  selected: Keyframe | null
  activity: Activity
  elapsed: string
  visitors: number | null
  frames: Readonly<Partial<Record<string, RasterFrame>>>
  tm?: TaskManagerVM
  amp?: AmpVM
  dialog: Dialog
  screensaver: boolean
}

/** The clickable rows, built by the hooks module (Client rows, or plain Text after a fault). */
export type StudioParts = { title: Tree; tabs: Tree; status: Tree }

export type StudioActions = TimelineActions &
  AmpActions & {
    live(): void
    dismissDialog(): void
  }

export const POSE_WORDS: Readonly<Record<Pose, string>> = {
  thinking: 'thinking',
  coding: 'coding',
  reading: 'reading',
  terminal: 'running a command',
  browsing: 'browsing the web',
  helper: 'calling a helper',
  oops: 'oops',
  waving: 'waving',
  done: 'done',
  idle: 'idle',
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

function rasterOf(els: Els, frame: RasterFrame | undefined) {
  const { Raster } = els
  return frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
}

function propertiesView(els: Els, vm: StudioVM, act: StudioActions) {
  const { Box, Text, Button } = els
  const { cols, activity, selected } = vm
  const isLine = false

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

function tabContent(els: Els, vm: StudioVM, act: StudioActions) {
  const { Box, Text } = els
  if (vm.tab === 'usage') return vm.tm === undefined ? null : taskManagerView(els, vm.tm, vm.frames)
  if (vm.tab === 'music') {
    if (vm.amp === undefined) return <Text color={vm.theme.ink}>Music is off. Turn it on in /config.</Text>
    return mascotAmpView(els, vm.amp, vm.frames, act)
  }
  return (
    <Box flexDirection="column">
      {timelineView(els, vm, act)}
      {propertiesView(els, vm, act)}
    </Box>
  )
}

/** The whole pane: title chrome, tabs, the Stage, the active tab and the status bar. */
export function studioView(els: Els, vm: StudioVM, act: StudioActions, parts: StudioParts) {
  const { Box, Text, Raster } = els
  const { cols, layout, theme } = vm
  if (layout.tooNarrow) {
    return (
      <Box backgroundColor={theme.body}>
        <Text color={theme.ink}>Widen the pane to see the studio.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={cols} backgroundColor={theme.body}>
      <Raster key="chrome" columns={cols} rows={1} cells={chromeCells(theme, cols)} />
      {parts.title}
      {parts.tabs}
      <Box key="stage-section" flexDirection="row" backgroundColor={theme.body}>
        <Text color={theme.body} backgroundColor={theme.body}>
          {' '}
        </Text>
        {rasterOf(els, vm.frames.stage)}
        {dialogView(els, vm.dialog, cols, () => act.dismissDialog())}
      </Box>
      <Box key="tab-content" flexDirection="column" height={layout.content} backgroundColor={theme.body}>
        {tabContent(els, vm, act)}
      </Box>
      {parts.status}
    </Box>
  )
}
