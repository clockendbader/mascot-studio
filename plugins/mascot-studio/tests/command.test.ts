import { test, expect } from 'claude-code/testing'
import { answerEngine, startSession } from './harness'

test('/studio opens the pane, and closes it when open', async ($, on) => {
  const { rec } = answerEngine(on)
  await startSession($)
  rec.opened.length = 0
  expect(await $.command.run({ command: 'studio', args: '' } as never)).toMatchObject({ text: expect.stringContaining('opened') })
  expect(rec.opened).toEqual(['mascot-studio'])
  expect(await $.command.run({ command: 'studio', args: '' } as never)).toMatchObject({ text: expect.stringContaining('closed') })
  expect(rec.closed).toEqual(['mascot-studio'])
})
