import { test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { answerEngine, completeTurn, mountPane, startSession, startTurn, waitFor } from './harness'

async function view($: Engine) {
  const ui = await mountPane($)
  const pose = (await ui.find({ type: 'Text', text: /Pose/ }))?.text ?? ''
  const keyframes = (await ui.findAll({ type: 'Button', text: '●' })).length
  const errors = (await ui.findAll({ type: 'Button', text: '✖' })).length
  const isStudio = (await ui.find({ key: 'stage' })) !== undefined
  return { ui, pose, keyframes, errors, isStudio }
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
  const v = await view($)
  expect(v.pose).toMatch(/Pose\s+thinking/)
  expect(v.keyframes).toBe(2)
  expect(v.isStudio).toBe(true)
})

test('a failed call shows its keyframe as ✖ with its first error line', async ($, on) => {
  answerEngine(on, { tool: () => ({ result: null, text: 'boom\nstack', isError: true }) })
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'u1', command: 'x' } as never)
  const v = await view($)
  expect(v.errors).toBe(1)
  await v.ui.press({ key: 'kf-1' })
  expect(await v.ui.find({ type: 'Text', text: /✖.*boom/ })).toBeDefined()
})

test('a finished turn hops, then switches to Scene 2 idle', async ($, on) => {
  const { clock } = answerEngine(on)
  await startSession($)
  await startTurn($)
  await completeTurn($)
  const hop = await view($)
  expect(hop.pose).toMatch(/Pose\s+done/)
  expect(hop.isStudio).toBe(true)
  await hop.ui.unmount()
  await clock.advance(1500)
  const later = await view($)
  expect(later.pose).toMatch(/Pose\s+idle/)
  expect(later.isStudio).toBe(false)
})

test('a subagent finishing changes nothing', async ($, on) => {
  const { clock } = answerEngine(on)
  await startSession($)
  await startTurn($)
  await completeTurn($, 't2', 'a1')
  await clock.advance(1500)
  const v = await view($)
  expect(v.pose).toMatch(/Pose\s+thinking/)
  expect(v.isStudio).toBe(true)
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
  const during = await view($)
  expect(during.pose).toMatch(/Pose\s+running a command/)
  await during.ui.unmount()
  pending.get('p2')?.()
  await p2
  expect((await view($)).pose).toMatch(/Pose\s+thinking/)
})
