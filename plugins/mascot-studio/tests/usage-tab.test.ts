import { test, expect } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import { THEMES } from '../hooks/themes'
import { answerEngine, completeTurn, measure, mountPane, startSession, startTurn } from './harness'

const TODAY_1610 = new Date(2026, 9, 5, 16, 10).toISOString()
const PLAN = {
  startedAt: 0,
  context: { tokens: 84000, window: 200000, percent: 42 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 31, resetsAt: TODAY_1610 },
    { kind: 'seven_day', percentUsed: 18 },
  ],
  cost: { usd: 0.84 },
}

async function usageTab($: Engine, clock: MockClock, cols = 46, rows = 24) {
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a' } as never)
  await completeTurn($)
  await clock.advance(1500)
  await $.command.run({ command: 'studio', args: 'usage' } as never)
  return mountPane($, cols, rows)
}

test('the Usage tab shows the figures on a plan', async ($, on) => {
  const { clock } = answerEngine(on, { usage: PLAN, os: 'windows' })
  const ui = await usageTab($, clock)
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '31%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '18%' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /↻ 4:10 PM/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Est\. cost \$0\.84 · 1 turns? · 1 tools?/ })).toBeDefined()
  expect(await ui.find({ key: 'ctx-graph' })).toBeDefined()
})

test('on an API key it says there are no plan limits', async ($, on) => {
  const { clock } = answerEngine(on, { usage: { ...PLAN, rateLimits: [] } })
  const ui = await usageTab($, clock)
  expect(await ui.find({ type: 'Text', text: /No plan limits \(API key\)/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ ?Cost \$0\.84/ })).toBeDefined()
})

test('a missing context figure shows a dash', async ($, on) => {
  const { clock } = answerEngine(on, { usage: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } })
  const ui = await usageTab($, clock)
  expect(await ui.find({ type: 'Text', text: '—' })).toBeDefined()
})

test('a refused startup read leaves the tab working until a measure arrives', async ($, on) => {
  const { clock, ctl } = answerEngine(on, { usage: PLAN })
  ctl.usageDeny = 'x'
  const ui = await usageTab($, clock)
  expect(await ui.find({ type: 'Text', text: '—' })).toBeDefined()
  await measure($, { percent: 42 })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: '42%' })).toBeDefined()
})

test('a bar turns the warning colour at 85%', async ($, on) => {
  const { clock } = answerEngine(on, { usage: { ...PLAN, context: { tokens: 170000, window: 200000, percent: 85 } }, os: 'windows' })
  const ui = await usageTab($, clock)
  const [lit, track] = await ui.findAll({ type: 'Text', text: /^▆+$/ })
  expect(lit?.props.color).toBe(THEMES.windows7.levels.warn)
  expect(track?.props.color).toBe(THEMES.windows7.status.bg)
})

test('details swaps the graph for token counts and reset dates', async ($, on) => {
  const { clock } = answerEngine(on, { usage: PLAN })
  const ui = await usageTab($, clock)
  await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'usage-controls' })
  expect(await ui.find({ type: 'Text', text: /84k of 200k tokens/ })).toBeDefined()
  expect(await ui.find({ key: 'ctx-graph' })).toBeUndefined()
  await $.command.run({ command: 'studio', args: 'details' } as never)
  await ui.redraw()
  expect(await ui.find({ key: 'ctx-graph' })).toBeDefined()
})

test('crossing 80% warns on the status line and dropping back clears it', async ($, on) => {
  const { rec } = answerEngine(on)
  await startSession($)
  await measure($, { percent: 84 })
  expect(rec.statuses.at(-1)).toBe('Clawd: context 84% · consider /compact')
  await measure($, { percent: 40 })
  expect(rec.statuses.at(-1)).toBeUndefined()
})

test('every Usage tab text sets its colour', async ($, on) => {
  const { clock } = answerEngine(on, { usage: PLAN })
  const ui = await usageTab($, clock)
  const content = await ui.find({ key: 'tab-content' })
  const walk = (n: unknown): void => {
    if (typeof n !== 'object' || n === null) return
    const node = n as { type?: string; props?: { color?: string }; children?: unknown[] }
    if (node.type === 'Text') expect(node.props?.color).toBeDefined()
    for (const child of node.children ?? []) walk(child)
  }
  walk(content)
})
