import { test, expect } from 'claude-code/testing'
import { answerEngine, mountPane, startSession } from './harness'

const HINT = 'Mascot Studio: type /studio to open it.'

test('the studio opens itself when a session starts', async ($, on) => {
  const { rec } = answerEngine(on)
  await startSession($)
  expect(rec.opened).toEqual(['mascot-studio'])
})

test('openOnStartup off opens nothing', { options: { openOnStartup: false } }, async ($, on) => {
  const { rec } = answerEngine(on)
  await startSession($)
  expect(rec.opened).toEqual([])
})

test('a session with no terminal opens nothing and /studio explains', async ($, on) => {
  const { rec } = answerEngine(on, { surfaces: ['desktop'] })
  await startSession($)
  expect(rec.opened).toEqual([])
  expect(await $.command.run({ command: 'studio', args: '' } as never)).toMatchObject({
    text: 'Mascot Studio runs in the terminal for now.',
  })
  expect(rec.opened).toEqual([])
})

test('a startup pane placed inline closes itself and hints once', async ($, on) => {
  const { rec, clock } = answerEngine(on)
  await startSession($)
  const first = await mountPane($, 46, 30, 'inline')
  await clock.advance(0)
  expect(rec.closed).toEqual(['mascot-studio'])
  expect(rec.toasts).toEqual([HINT])
  await first.unmount()
  await mountPane($, 46, 30, 'inline')
  await clock.advance(0)
  expect(rec.toasts).toEqual([HINT])
})

test('a pane the person opened stays inline', { options: { openOnStartup: false } }, async ($, on) => {
  const { rec, clock } = answerEngine(on)
  await startSession($)
  await $.command.run({ command: 'studio', args: '' } as never)
  const ui = await mountPane($, 46, 30, 'inline')
  await clock.advance(0)
  expect(rec.closed).toEqual([])
  expect(await ui.find({ type: 'Text', text: /Timeline/ })).toBeDefined()
})
