import { test, expect, describe } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { clipColor } from '../hooks/art/instruments'
import { answerEngine, mountPane, startSession, startTurn } from './harness'

type Mounted = Awaited<ReturnType<typeof mountPane>>
type StripProps = { clips: { n: number; color: string }[]; current: number; selected: number | null }

async function strip(ui: Mounted): Promise<StripProps> {
  return ((await ui.find({ key: 'filmstrip' }))?.props as { props: StripProps }).props
}

async function threeSteps($: Engine, fail = false) {
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/work/a.ts' } as never)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'u2', file_path: '/work/hooks/studio.tsx' } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'u3', command: fail ? 'false' : 'npm test' } as never)
}

const failingBash = (e: { tool: string }) => (e.tool === 'Bash' ? { result: null, text: 'exit 1\nmore', isError: true } : { result: 'ok', text: 'ok' })

test('clipColor colours a step by what it did', () => {
  const base = { id: 'x', n: 1, target: '', startedAt: 0 }
  expect(clipColor({ ...base, tool: 'Read', pose: 'reading' })).toBe('#4A90E2')
  expect(clipColor({ ...base, tool: 'Edit', pose: 'coding' })).toBe('#D97757')
  expect(clipColor({ ...base, tool: 'Bash', pose: 'terminal' })).toBe('#4B5563')
  expect(clipColor({ ...base, tool: 'WebFetch', pose: 'browsing' })).toBe('#2EAD6B')
  expect(clipColor({ ...base, tool: 'Agent', pose: 'helper' })).toBe('#8E5CD9')
  expect(clipColor({ ...base, tool: 'Edit', pose: 'coding', isError: true })).toBe('#E5484D')
})

test('the film strip holds one coloured clip per step', async ($, on) => {
  answerEngine(on, { tool: failingBash })
  await threeSteps($, true)
  const ui = await mountPane($, 46, 24)
  const s = await strip(ui)
  expect(s.clips.map(c => c.color)).toEqual(['#4A90E2', '#D97757', '#E5484D'])
  expect(s.current).toBe(3)
})

test('clicking a clip pins that step in the inspector', async ($, on) => {
  answerEngine(on)
  await threeSteps($)
  const ui = await mountPane($, 46, 24)
  await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'filmstrip' })
  expect(await ui.find({ type: 'Text', text: /Step 2 · Edit/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✓/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /studio\.tsx/ })).toBeDefined()
  expect((await strip(ui)).selected).toBe(2)
})

describe('stepping through', () => {
  test('prev and next walk the steps and live unpins', async ($, on) => {
    answerEngine(on)
    await threeSteps($)
    await $.command.run({ command: 'studio', args: 'prev' } as never)
    let ui = await mountPane($, 46, 24)
    expect(await ui.find({ type: 'Text', text: /Step 3 · Bash/ })).toBeDefined()
    await ui.unmount()
    await $.command.run({ command: 'studio', args: 'prev' } as never)
    ui = await mountPane($, 46, 24)
    expect(await ui.find({ type: 'Text', text: /Step 2 · Edit/ })).toBeDefined()
    await ui.unmount()
    await $.command.run({ command: 'studio', args: 'next' } as never)
    await $.command.run({ command: 'studio', args: 'live' } as never)
    ui = await mountPane($, 46, 24)
    expect(await ui.find({ type: 'Text', text: /Step \d/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /Clawd is/ })).toBeDefined()
  })

  test('the controls row clicks do the same', async ($, on) => {
    answerEngine(on)
    await threeSteps($)
    const ui = await mountPane($, 46, 24)
    await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'tl-controls' })
    expect(await ui.find({ type: 'Text', text: /Step 3 · Bash/ })).toBeDefined()
  })
})

test('a failed step shows its error line', async ($, on) => {
  answerEngine(on, { tool: failingBash })
  await threeSteps($, true)
  await $.command.run({ command: 'studio', args: 'prev' } as never)
  const ui = await mountPane($, 46, 24)
  expect(await ui.find({ type: 'Text', text: /✖/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /exit 1/ })).toBeDefined()
})


test('the header shows the hit counter, dropped first when narrow', async ($, on) => {
  answerEngine(on, { store: { visitors: 426 } })
  await threeSteps($)
  const wide = await mountPane($, 60, 24)
  expect(await wide.find({ type: 'Text', text: /visitor #000429/ })).toBeDefined()
  await wide.unmount()
  const narrow = await mountPane($, 32, 24)
  expect(await narrow.find({ type: 'Text', text: /visitor #/ })).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /Steps this turn/ })).toBeDefined()
})
