import { test, expect } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
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

async function scene2($: Engine, clock: MockClock, cols = 46, rows = 30) {
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a' } as never)
  await completeTurn($)
  await clock.advance(1500)
  await $.command.run({ command: 'studio', args: 'usage' } as never)
  return mountPane($, cols, rows)
}

test('the Usage tab shows the figures on a plan', async ($, on) => {
  const { clock } = answerEngine(on, { usage: PLAN })
  const ui = await scene2($, clock)
  expect(await ui.find({ type: 'Text', text: '42 %' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /5-hour/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /31%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Weekly/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /18%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /resets 4:10 PM/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Est\. cost\s+\$0\.84/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Tools: 1\s+Context: 42%\s+5-hour: 31%/ })).toBeDefined()
  for (const key of ['tm-title', 'ctx-meter', 'ctx-graph']) expect(await ui.find({ key })).toBeDefined()
})

test('the Usage tab on an API key says there are no plan limits', async ($, on) => {
  const { clock } = answerEngine(on, { usage: { ...PLAN, rateLimits: [] } })
  const ui = await scene2($, clock)
  expect(await ui.find({ type: 'Text', text: 'No plan limits (API key)' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\s*Cost\s+\$0\.84/ })).toBeDefined()
})

test('crossing 80% warns on the status line and dropping back clears it', async ($, on) => {
  const { rec } = answerEngine(on)
  await startSession($)
  await measure($, { percent: 84 })
  expect(rec.statuses.at(-1)).toBe('ᓚᘏᗢ context 84% · consider /compact')
  await measure($, { percent: 40 })
  expect(rec.statuses.at(-1)).toBeUndefined()
})

test('a missing context figure shows a dash', async ($, on) => {
  const { clock } = answerEngine(on, { usage: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } })
  const ui = await scene2($, clock)
  expect(await ui.find({ type: 'Text', text: '— %' })).toBeDefined()
})

test('a refused startup read leaves the studio working until a measure arrives', async ($, on) => {
  const { clock, ctl } = answerEngine(on, { usage: PLAN })
  ctl.usageDeny = 'x'
  const ui = await scene2($, clock)
  expect(await ui.find({ type: 'Text', text: '— %' })).toBeDefined()
  await measure($, { percent: 42 })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: '42 %' })).toBeDefined()
})


test('the history graph gains a sample per finished turn', async ($, on) => {
  const { clock } = answerEngine(on, { usage: PLAN })
  await startSession($)
  for (const id of ['t1', 't2']) {
    await startTurn($, id)
    await completeTurn($, id)
  }
  await clock.advance(1500)
  await $.command.run({ command: 'studio', args: 'usage' } as never)
  const first = await mountPane($)
  const graph = (await first.find({ key: 'ctx-graph' }))?.props as { cells: string } | undefined
  expect(graph?.cells).toBeDefined()
})
