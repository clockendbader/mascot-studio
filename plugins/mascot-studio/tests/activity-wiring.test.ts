import { test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { answerEngine, completeTurn, mountPane, startSession, startTurn, waitFor } from './harness'

async function line($: Engine): Promise<string> {
  const ui = await mountPane($)
  const text = (await ui.find({ type: 'Text', text: 'pose=' }))?.text ?? ''
  await ui.unmount()
  return text
}

test('a tool call passes through unchanged', async ($, on) => {
  answerEngine(on)
  await startSession($)
  expect(await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a.ts' } as never)).toMatchObject({ text: 'ok' })
})

test('tool calls add keyframes and the pose returns to thinking', async ($, on) => {
  answerEngine(on)
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a.ts' } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'u2', command: 'ls' } as never)
  expect(await line($)).toMatch(/pose=thinking frames=2 scene=1/)
})

test('a failed call records its first error line', async ($, on) => {
  answerEngine(on, { tool: () => ({ result: null, text: 'boom\nstack', isError: true }) })
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'u1', command: 'x' } as never)
  expect(await line($)).toMatch(/err=boom$/)
})

test('a finished turn hops, then switches to Scene 2 asleep', async ($, on) => {
  const { clock } = answerEngine(on)
  await startSession($)
  await startTurn($)
  await completeTurn($)
  expect(await line($)).toMatch(/pose=hop .*scene=1/)
  await clock.advance(1500)
  expect(await line($)).toMatch(/pose=asleep .*scene=2/)
})

test('a subagent finishing changes nothing', async ($, on) => {
  const { clock } = answerEngine(on)
  await startSession($)
  await startTurn($)
  await completeTurn($, 't2', 'a1')
  await clock.advance(1500)
  expect(await line($)).toMatch(/pose=thinking frames=0 scene=1/)
})

test('parallel calls keep the newest pose until all have settled', async ($, on) => {
  const pending = new Map<string, () => void>()
  const { clock } = answerEngine(on, {
    tool: e => new Promise(resolve => pending.set(e.tool_use_id ?? '', () => resolve({ result: 'ok', text: 'ok' }))),
  })
  await startSession($)
  await startTurn($)
  const p1 = $.tool.call({ tool: 'Read', tool_use_id: 'p1', file_path: '/a' } as never)
  await waitFor(clock, () => pending.has('p1'))
  const p2 = $.tool.call({ tool: 'Bash', tool_use_id: 'p2', command: 'ls' } as never)
  await waitFor(clock, () => pending.has('p2'))
  pending.get('p1')?.()
  await p1
  expect(await line($)).toMatch(/pose=keyboard/)
  pending.get('p2')?.()
  await p2
  expect(await line($)).toMatch(/pose=thinking/)
})
