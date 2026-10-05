import type { Elements } from 'claude-code'

import type { Activity, Keyframe, Pose } from '../../types'
import { truncateMiddle } from '../activity'
import type { RowSegment } from '../client/row'
import type { Theme } from '../themes'
import { fitRow } from './chrome'

type Els = Elements['terminal']
type Tree = ReturnType<Els['Box']>

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

const ICONS: Readonly<Partial<Record<Pose, string>>> = {
  reading: '»',
  coding: '✎',
  terminal: '$',
  browsing: '@',
  helper: '+',
  waving: '?',
}
const OK_GREEN = '#2E8B57'
const FAIL_RED = '#E5484D'

export type TimelineTabVM = {
  cols: number
  theme: Theme
  current: number
  selected: Keyframe | null
  activity: Activity
  elapsed: string
  visitors: number | null
}

function duration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

/** `◀ prev`, `next ▶` and, while a step is pinned, `Back to live`. */
export function timelineControls(theme: Theme, cols: number, pinned: boolean): RowSegment[] {
  const { tabs } = theme
  const gap = (text: string): RowSegment => ({ id: '', text, fg: theme.ink, bg: theme.body })
  const segments: RowSegment[] = [
    gap(' '),
    { id: 'prev', text: ' ◀ prev ', fg: tabs.text, bg: tabs.idle, hoverBg: tabs.hover, key: 'a' },
    gap(' '),
    { id: 'next', text: ' next ▶ ', fg: tabs.text, bg: tabs.idle, hoverBg: tabs.hover, key: 'd' },
  ]
  if (pinned) {
    const used = 1 + 8 + 1 + 8
    const live = ' Back to live '
    segments.push(gap(' '.repeat(Math.max(1, cols - used - live.length - 1))))
    segments.push({ id: 'live', text: live, fg: '#FFFFFF', bg: theme.accent, hoverBg: theme.ink, bold: true, key: 'l' })
  }
  return fitRow(segments, cols, theme.body, theme.ink)
}

function header(els: Els, vm: TimelineTabVM) {
  const { Box, Text } = els
  const left = ` Steps this turn${vm.elapsed === '' ? '' : ` · ${vm.elapsed}`}`
  const right = vm.visitors === null ? '' : `visitor #${String(vm.visitors).padStart(6, '0')} `
  const room = vm.cols - [...left].length
  const showRight = right !== '' && room >= right.length + 2
  return (
    <Box flexDirection="row">
      <Text color={vm.theme.soft} bold>
        {left}
      </Text>
      {showRight ? <Text color={vm.theme.soft}>{right.padStart(room)}</Text> : null}
    </Box>
  )
}

function inspector(els: Els, vm: TimelineTabVM) {
  const { Box, Text } = els
  const { theme, selected } = vm
  const width = Math.max(1, vm.cols - 2)
  if (selected !== null) {
    const outcome =
      selected.durationMs === undefined
        ? { text: '… running', color: theme.soft }
        : selected.isError === true
          ? { text: `✖ ${duration(selected.durationMs)}`, color: FAIL_RED }
          : { text: `✓ ${duration(selected.durationMs)}`, color: OK_GREEN }
    const title = ` ${ICONS[selected.pose] ?? '•'} Step ${selected.n} · ${selected.tool}`
    const detail = selected.isError === true && selected.errorLine !== undefined ? selected.errorLine : selected.target
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color={theme.ink} bold>
            {title}
          </Text>
          <Text color={outcome.color}>{`  ${outcome.text}`}</Text>
        </Box>
        <Text color={selected.isError === true ? FAIL_RED : theme.soft} wrap="truncate-end">
          {` ${truncateMiddle(detail, width)}`}
        </Text>
      </Box>
    )
  }
  const { activity } = vm
  const tool = activity.tool ?? 'Claude'
  return (
    <Box flexDirection="column">
      <Text color={theme.ink} wrap="truncate-end">
        {` ${ICONS[activity.pose] ?? '•'} ${tool}  ${truncateMiddle(activity.target ?? '', Math.max(1, width - tool.length - 3))}`}
      </Text>
      <Text color={theme.soft} wrap="truncate-end">
        {` Clawd is ${POSE_WORDS[activity.pose]} · step ${vm.current}`}
      </Text>
    </Box>
  )
}

/** The Timeline tab: header, film strip (a Client, or its Raster fallback), inspector and step controls. */
export function timelineTabView(els: Els, vm: TimelineTabVM, strip: Tree, controls: Tree): Tree {
  const { Box, Text } = els
  return (
    <Box flexDirection="column">
      {header(els, vm)}
      <Box flexDirection="row">
        <Text color={vm.theme.body}> </Text>
        {strip}
      </Box>
      {inspector(els, vm)}
      {controls}
    </Box>
  )
}
