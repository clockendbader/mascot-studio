import type { Elements } from 'claude-code'

import type { RasterFrame } from '../animator'
import { level } from '../usage'
import type { Level, limitsView } from '../usage'

type Els = Elements['terminal']

export type TaskManagerVM = {
  cols: number
  boxes: boolean
  pct?: number
  limits: ReturnType<typeof limitsView>
  costLabel: string
  costUsd?: number
  turns: number
  toolCalls: number
}

/** Columns and rows of the Scene 2 rasters for a body width. */
export function taskManagerSizes(cols: number) {
  return { titleCols: cols - 2, meterCols: 7, meterRows: 4, graphCols: cols - 15, graphRows: 5 }
}

const LEVEL_COLOR: Readonly<Record<Level, string>> = { ok: '#00FF00', warn: '#FFB000', critical: '#FF3030' }
const CONTEXT_W = 11
const LIMITS_MAX = 26
const TOTALS_MIN = 18

const percentText = (pct: number | undefined) => (pct === undefined ? '— %' : `${pct} %`)

/** A box drawn from text: its title set in the top edge, `children` filling `height` rows inside. */
function framed(els: Els, title: string, width: number, height: number, children: unknown) {
  const { Box, Text } = els
  const inner = width - 2
  const side = Array<string>(height).fill('│').join('\n')
  const top = `┌ ${title} `.slice(0, width - 1).padEnd(width - 1, '─') + '┐'
  return (
    <Box flexDirection="column" width={width}>
      <Text>{top}</Text>
      <Box flexDirection="row">
        <Text>{side}</Text>
        <Box flexDirection="column" width={inner}>
          {children as never}
        </Box>
        <Text>{side}</Text>
      </Box>
      <Text>{'└' + '─'.repeat(inner) + '┘'}</Text>
    </Box>
  )
}

function bar(els: Els, label: string, pct: number | undefined, inner: number) {
  const { Box, Text } = els
  const cells = Math.max(3, inner - 13)
  const lit = pct === undefined ? 0 : Math.round((Math.min(100, pct) / 100) * cells)
  return (
    <Box flexDirection="row">
      <Text>{` ${label.padEnd(6)} `}</Text>
      <Text color={LEVEL_COLOR[level(pct)]}>{'█'.repeat(lit)}</Text>
      <Text dimColor>{'░'.repeat(cells - lit)}</Text>
      <Text>{pct === undefined ? ' —' : ` ${pct}%`}</Text>
    </Box>
  )
}

function totalLine(els: Els, label: string, value: string, inner: number) {
  const { Text } = els
  return <Text wrap="truncate-end">{` ${label}`.padEnd(Math.max(label.length + 2, inner - value.length)) + value}</Text>
}

/** Scene 2: the Task Manager's Performance tab, Claude's figures in it. */
export function taskManagerView(els: Els, tm: TaskManagerVM, frames: Readonly<Partial<Record<string, RasterFrame>>>) {
  const { Box, Text, Raster } = els
  const raster = (frame: RasterFrame | undefined) =>
    frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
  const historyW = tm.cols - 2 - CONTEXT_W
  const limitsW = Math.max(16, Math.min(LIMITS_MAX, tm.cols - 2 - TOTALS_MIN))
  const totalsW = tm.cols - 2 - limitsW
  const { limits } = tm
  const cost = tm.costUsd === undefined ? '—' : `$${tm.costUsd.toFixed(2)}`
  const status = [
    `Tools: ${tm.toolCalls}`,
    `Context: ${tm.pct === undefined ? '—' : `${tm.pct}%`}`,
    ...(limits.fiveHour !== undefined ? [`5-hour: ${limits.fiveHour}%`] : []),
  ].join('   ')

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Text> </Text>
        {raster(frames['tm-title'])}
      </Box>
      <Text>{'  Applications   Processes  [Performance]'}</Text>
      <Box flexDirection="row">
        <Text> </Text>
        {framed(els, 'Context', CONTEXT_W, 5, [
          <Box flexDirection="row">
            <Text> </Text>
            {raster(frames['ctx-meter'])}
          </Box>,
          <Text>{percentText(tm.pct).padStart(6).padEnd(CONTEXT_W - 2)}</Text>,
        ])}
        {framed(els, 'Context History', historyW, 5, raster(frames['ctx-graph']))}
      </Box>
      {tm.boxes ? (
        <Box flexDirection="row">
          <Text> </Text>
          {framed(
            els,
            'Limits',
            limitsW,
            3,
            limits.isApiKey
              ? [<Text wrap="truncate-end">No plan limits (API key)</Text>]
              : [
                  bar(els, '5-hour', limits.fiveHour, limitsW - 2),
                  bar(els, 'Weekly', limits.weekly, limitsW - 2),
                  <Text wrap="truncate-end">{limits.reset === '' ? '' : ` resets ${limits.reset}`}</Text>,
                ],
          )}
          {framed(els, 'Totals', totalsW, 3, [
            totalLine(els, 'Turns', String(tm.turns), totalsW - 2),
            totalLine(els, 'Tool calls', String(tm.toolCalls), totalsW - 2),
            totalLine(els, tm.costLabel, cost, totalsW - 2),
          ])}
        </Box>
      ) : null}
      <Text wrap="truncate-end">{` ${status}`}</Text>
    </Box>
  )
}
