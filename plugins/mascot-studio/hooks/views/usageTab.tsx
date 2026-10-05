import type { Elements } from 'claude-code'

import type { UsageSnapshot } from '../../types'
import { formatReset } from '../calendar'
import type { RowSegment } from '../client/row'
import type { Theme } from '../themes'
import { costLabel, level } from '../usage'
import { fitRow } from './chrome'

type Els = Elements['terminal']
type Tree = ReturnType<Els['Box']>

export type UsageTabVM = {
  cols: number
  theme: Theme
  usage: UsageSnapshot
  turns: number
  toolCalls: number
  details: boolean
  now: Date
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const thousands = (n: number) => `${Math.round(n / 1000)}k`

/** `details ▸` while the graph shows, `◂ graph` while the details do (key i). */
export function usageControls(theme: Theme, cols: number, details: boolean): RowSegment[] {
  const { tabs } = theme
  return fitRow(
    [
      { id: '', text: ' ', fg: theme.ink, bg: theme.body },
      { id: 'details', text: details ? ' ◂ graph ' : ' details ▸ ', fg: tabs.text, bg: tabs.idle, hoverBg: tabs.hover, key: 'i' },
    ],
    cols,
    theme.body,
    theme.ink,
  )
}

function bar(els: Els, vm: UsageTabVM, label: string, pct: number | undefined, extra: string) {
  const { Box, Text } = els
  const { theme } = vm
  const cells = Math.max(5, vm.cols - 30)
  const lit = pct === undefined ? 0 : Math.round((Math.min(100, Math.max(0, pct)) / 100) * cells)
  return (
    <Box flexDirection="row">
      <Text color={theme.ink}>{` ${label.padEnd(8)}`}</Text>
      {lit > 0 ? <Text color={theme.levels[level(pct)]}>{'█'.repeat(lit)}</Text> : null}
      <Text color={theme.soft}>{'░'.repeat(cells - lit)}</Text>
      <Text color={theme.ink} bold>
        {pct === undefined ? ' —' : ` ${pct}%`}
      </Text>
      {extra === '' ? null : <Text color={theme.soft}>{` ${extra}`}</Text>}
    </Box>
  )
}

/** The Usage tab: context and plan-limit bars with reset times, totals, and the history graph or the details. */
export function usageTabView(els: Els, vm: UsageTabVM, graph: Tree | null, controls: Tree): Tree {
  const { Box, Text } = els
  const { theme, usage, now } = vm
  const fiveHour = usage.rateLimits.find(limit => limit.kind === 'five_hour')
  const weekly = usage.rateLimits.find(limit => limit.kind === 'seven_day')
  const isApiKey = usage.rateLimits.length === 0
  const resetOf = (limit: typeof fiveHour) => formatReset(limit?.resetsAt, now)
  const cost = usage.costUsd === undefined ? '—' : `$${usage.costUsd.toFixed(2)}`
  const tokens = usage.contextTokens === undefined ? '' : `${thousands(usage.contextTokens)} tok`
  const window = usage.contextWindow === undefined ? '' : ` of ${thousands(usage.contextWindow)}`

  return (
    <Box flexDirection="column">
      <Text color={theme.soft} bold>
        {' Claude usage'}
      </Text>
      {bar(els, vm, 'Context', usage.contextPercent, tokens)}
      {isApiKey ? (
        <Text color={theme.soft}>{' No plan limits (API key)'}</Text>
      ) : (
        <Box flexDirection="column">
          {bar(els, vm, '5-hour', fiveHour?.percentUsed, resetOf(fiveHour) === '' ? '' : `↻ ${resetOf(fiveHour)}`)}
          {bar(els, vm, 'Weekly', weekly?.percentUsed, resetOf(weekly) === '' ? '' : `↻ ${resetOf(weekly)}`)}
        </Box>
      )}
      <Text color={theme.ink} wrap="truncate-end">
        {` ${costLabel(usage)} ${cost} · ${plural(vm.turns, 'turn')} · ${plural(vm.toolCalls, 'tool')}`}
      </Text>
      {vm.details ? (
        <Box flexDirection="column">
          <Text color={theme.soft} wrap="truncate-end">
            {` ${usage.contextTokens === undefined ? '—' : thousands(usage.contextTokens)}${window} tokens · ${isApiKey ? 'API key' : 'plan'}`}
          </Text>
          <Text color={theme.soft} wrap="truncate-end">
            {` resets: 5-hour ${resetOf(fiveHour) || '—'} · weekly ${resetOf(weekly) || '—'}`}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row">
          <Text color={theme.body}>{'  '}</Text>
          {graph}
        </Box>
      )}
      {controls}
    </Box>
  )
}
