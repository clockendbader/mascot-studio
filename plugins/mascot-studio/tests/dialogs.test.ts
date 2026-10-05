import { test, expect, describe } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import { QUESTION_TEXT, needsYouText } from '../hooks/alerts'
import { answerEngine, completeTurn, measure, mountPane, startSession, startTurn, waitFor } from './harness'

const WAITING = 'ᓚᘏᗢ Mascot is waiting on you'
const ENOENT = { result: null, text: 'ENOENT: no such file\n at x', isError: true }

async function view($: Engine) {
  const ui = await mountPane($, 46, 32)
  return {
    ui,
    pose: (await ui.find({ type: 'Text', text: /Pose/ }))?.text ?? '',
    dialog: await ui.find({ key: 'dialog' }),
  }
}

test('needsYouText and the question text', () => {
  expect(needsYouText('Bash', 'npm test')).toBe('MascotProgramming: hey! i need ur OK to run Bash: npm test')
  expect(QUESTION_TEXT).toBe('MascotProgramming: hey! i have a question for you')
})

describe('error dialog', () => {
  async function failed($: Engine, clock: MockClock) {
    await startSession($)
    await startTurn($)
    await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/missing' } as never)
    await waitFor(clock, () => false)
  }

  test('a failed call facepalms and shows the error', async ($, on) => {
    let fail = true
    const { clock } = answerEngine(on, { tool: () => (fail ? ENOENT : { result: 'ok', text: 'ok' }) })
    await failed($, clock)
    fail = false
    const v = await view($)
    expect(v.pose).toMatch(/Pose\s+facepalm/)
    expect(v.dialog).toBeDefined()
    expect(await v.ui.find({ type: 'Text', text: 'Mascot Programming' })).toBeDefined()
    expect(await v.ui.find({ type: 'Text', text: /✖.*Read failed: ENOENT: no such file/ })).toBeDefined()
  })

  test('OK closes it', async ($, on) => {
    const { clock } = answerEngine(on, { tool: () => ENOENT })
    await failed($, clock)
    const v = await view($)
    await v.ui.press({ key: 'ok' })
    expect(await v.ui.find({ key: 'dialog' })).toBeUndefined()
  })

  test('the next tool call closes it', async ($, on) => {
    let fail = true
    const { clock } = answerEngine(on, { tool: () => (fail ? ENOENT : { result: 'ok', text: 'ok' }) })
    await failed($, clock)
    fail = false
    await $.tool.call({ tool: 'Read', tool_use_id: 'u2', file_path: '/b' } as never)
    expect((await view($)).dialog).toBeUndefined()
  })

  test('it closes itself after eight seconds', async ($, on) => {
    const { clock } = answerEngine(on, { tool: () => ENOENT })
    await failed($, clock)
    await clock.advance(8000)
    expect((await view($)).dialog).toBeUndefined()
  })
})

describe('needs you', () => {
  test('a permission prompt waves, explains and sets the status line', async ($, on) => {
    const { rec } = answerEngine(on)
    await startSession($)
    await startTurn($)
    expect(await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } } as never)).toEqual({})
    const v = await view($)
    expect(v.pose).toMatch(/Pose\s+waving/)
    expect(await v.ui.find({ type: 'Text', text: 'MascotProgramming: hey! i need ur OK to run Bash: npm test' })).toBeDefined()
    expect(rec.statuses.at(-1)).toBe(WAITING)
  })

  test('the next call settling clears it and the status falls back', async ($, on) => {
    const { rec } = answerEngine(on)
    await startSession($)
    await measure($, { percent: 84 })
    await startTurn($)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } } as never)
    expect(rec.statuses.at(-1)).toBe(WAITING)
    await $.tool.call({ tool: 'Bash', tool_use_id: 'u1', command: 'npm test' } as never)
    expect((await view($)).dialog).toBeUndefined()
    expect(rec.statuses.at(-1)).toBe('ᓚᘏᗢ context 84% · consider /compact')
  })

  test('a finished turn clears it', async ($, on) => {
    const { rec } = answerEngine(on)
    await startSession($)
    await startTurn($)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'x' } } as never)
    await completeTurn($)
    expect((await view($)).dialog).toBeUndefined()
    expect(rec.statuses.at(-1)).toBeUndefined()
  })

  test('a new prompt clears it', async ($, on) => {
    answerEngine(on)
    await startSession($)
    await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'x' } } as never)
    await $.prompt.submit({ text: 'never mind' } as never)
    expect((await view($)).dialog).toBeUndefined()
  })

  test('a permission notification does the same', async ($, on) => {
    const { rec } = answerEngine(on)
    await startSession($)
    await $.classic.Notification({ message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' } as never)
    const v = await view($)
    expect(v.pose).toMatch(/Pose\s+waving/)
    expect(await v.ui.find({ type: 'Text', text: /MascotProgramming: hey! i need ur OK/ })).toBeDefined()
    expect(rec.statuses.at(-1)).toBe(WAITING)
  })

  test('other notifications are ignored', async ($, on) => {
    answerEngine(on)
    await startSession($)
    await $.classic.Notification({ message: 'idle', notification_type: 'idle_prompt' } as never)
    expect((await view($)).dialog).toBeUndefined()
  })

  test('a question waits with the question text until answered', async ($, on) => {
    let answer: (() => void) | undefined
    const { clock } = answerEngine(on, {
      tool: e => (e.tool === 'AskUserQuestion' ? new Promise(resolve => (answer = () => resolve({ result: 'a', text: 'a' }))) : { result: 'ok', text: 'ok' }),
    })
    await startSession($)
    await startTurn($)
    const asked = $.tool.call({ tool: 'AskUserQuestion', tool_use_id: 'q1', questions: [] } as never)
    await waitFor(clock, () => answer !== undefined)
    const during = await view($)
    expect(await during.ui.find({ type: 'Text', text: QUESTION_TEXT })).toBeDefined()
    await during.ui.unmount()
    answer?.()
    await asked
    expect((await view($)).dialog).toBeUndefined()
  })
})
