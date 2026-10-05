import type { Elements } from 'claude-code'

import type { Keyframe } from '../../types'
import { layerCells, timelineWindow } from '../activity'

type Els = Elements['terminal']

export const LABEL_COLS = 10
const PLAYHEAD_RED = '#FF3030'
const FOOTER_SEP = ' · '

export type TimelineVM = {
  cols: number
  keyframes: readonly Keyframe[]
  soundFrames: readonly number[]
  current: number
  elapsed: string
  visitors: number | null
}

export type TimelineActions = {
  selectFrame(n: number): void
}

/** Frame numbers at 1 and every 5th frame, as far as each fits before the next. */
function rulerText(start: number, width: number): string {
  const cells = Array<string>(width).fill(' ')
  for (let i = 0; i < width; i++) {
    const n = start + i
    if (n !== 1 && n % 5 !== 0) continue
    const label = String(n)
    if (i + label.length > width) break
    if (cells.slice(i, i + label.length).some(cell => cell !== ' ')) continue
    for (let j = 0; j < label.length; j++) cells[i + j] = label[j] ?? ' '
  }
  return cells.join('')
}

/** The footer's parts, dropped from the right until they fit. */
function footerText(vm: TimelineVM, room: number): string {
  const parts = [`frame ${vm.current}`]
  if (vm.elapsed !== '') parts.push(vm.elapsed)
  if (vm.visitors !== null) parts.push(`visitor #${String(vm.visitors).padStart(6, '0')}`)
  while (parts.length > 0 && (FOOTER_SEP + parts.join(FOOTER_SEP)).length > room) parts.pop()
  return parts.length === 0 ? '' : FOOTER_SEP + parts.join(FOOTER_SEP)
}

export function timelineView(els: Els, vm: TimelineVM, act: TimelineActions) {
  const { Box, Text, Button } = els
  const width = vm.cols - LABEL_COLS
  const win = timelineWindow(vm.current, width)
  const byFrame = new Map(vm.keyframes.map(frame => [frame.n, frame]))
  const soundKeys = new Set(vm.soundFrames)
  const ruler = rulerText(win.start, width)
  const at = vm.current - win.start

  const catRow = layerCells('all', win, vm.current).map((kind, i) => {
    const n = win.start + i
    if (kind === 'future') return <Text dimColor>·</Text>
    const frame = byFrame.get(n)
    if (frame === undefined) return <Text dimColor>●</Text>
    return <Button key={`kf-${n}`} plain label={frame.isError === true ? '✖' : '●'} onPress={() => act.selectFrame(n)} />
  })

  const soundRow = layerCells(soundKeys, win, vm.current).map(kind => {
    if (kind === 'future') return <Text dimColor>·</Text>
    if (kind === 'playhead') return <Text color={PLAYHEAD_RED}>{soundKeys.has(vm.current) ? '●' : '─'}</Text>
    return <Text>{kind === 'key' ? '●' : '─'}</Text>
  })

  return (
    <Box flexDirection="column">
      {at >= 0 && at < width ? (
        <Box flexDirection="row">
          <Text>{' '.repeat(LABEL_COLS) + ruler.slice(0, at)}</Text>
          <Text color={PLAYHEAD_RED}>▼</Text>
          <Text>{ruler.slice(at + 1)}</Text>
        </Box>
      ) : (
        <Text>{' '.repeat(LABEL_COLS) + ruler}</Text>
      )}
      <Box flexDirection="row">
        <Text>{' ✎ Cat    '}</Text>
        {catRow}
      </Box>
      <Box flexDirection="row">
        <Text>{' ♪ Sound  '}</Text>
        {soundRow}
      </Box>
      <Text dimColor wrap="truncate-end">{footerText(vm, vm.cols - 2)}</Text>
    </Box>
  )
}
