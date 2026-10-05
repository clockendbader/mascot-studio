import { test, expect } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { stageCells } from '../hooks/art/stage'
import { THEMES } from '../hooks/themes'
import { answerEngine, mountPane, startSession } from './harness'

async function footer($: Engine): Promise<string> {
  const ui = await mountPane($, 60, 32)
  const text = (await ui.find({ type: 'Text', text: /visitor #/ }))?.text ?? ''
  await ui.unmount()
  return text
}

const call = ($: Engine, id: string) => $.tool.call({ tool: 'Read', tool_use_id: id, file_path: '/a' } as never)

test('the counter carries on from the stored lifetime total', async ($, on) => {
  const { ctl } = answerEngine(on, { store: { visitors: 426 } })
  await startSession($)
  await call($, 'u1')
  expect(await footer($)).toContain('visitor #000427')
  expect(ctl.store.get('visitors')).toBe(427)
})

test('an empty store starts at zero', async ($, on) => {
  answerEngine(on)
  await startSession($)
  await call($, 'u1')
  expect(await footer($)).toContain('visitor #000001')
})

test('a refused write keeps counting and catches up on the next call', async ($, on) => {
  const { ctl } = answerEngine(on)
  await startSession($)
  ctl.storeDeny = 'disk full'
  await call($, 'u1')
  expect(await footer($)).toContain('visitor #000001')
  expect(ctl.store.has('visitors')).toBe(false)
  ctl.storeDeny = undefined
  await call($, 'u2')
  expect(ctl.store.get('visitors')).toBe(2)
})

test('a stored value that is not a number starts over at zero', async ($, on) => {
  answerEngine(on, { store: { visitors: 'lots' } })
  await startSession($)
  await call($, 'u1')
  expect(await footer($)).toContain('visitor #000001')
})

async function stageOn($: Engine) {
  const ui = await mountPane($, 46, 32)
  return ((await ui.find({ key: 'stage' }))?.props as { cells: string } | undefined)?.cells
}

test('October puts the pumpkin on the mascot', async ($, on) => {
  answerEngine(on, { now: new Date(2026, 9, 5, 12).getTime(), os: 'windows' })
  await startSession($)
  expect(await stageOn($)).toBe(stageCells({ cols: 44, pose: 'idle', hat: 'pumpkin', tick: 0, backdrop: THEMES.windows7.backdrop }))
})

test('an ordinary day has no hat', async ($, on) => {
  answerEngine(on, { now: new Date(2026, 6, 4, 12).getTime(), os: 'windows' })
  await startSession($)
  expect(await stageOn($)).toBe(stageCells({ cols: 44, pose: 'idle', hat: 'none', tick: 0, backdrop: THEMES.windows7.backdrop }))
})
