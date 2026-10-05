import { test, expect, describe } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import { answerEngine, mountPane, startSession, startTurn } from './harness'

const SIZES = [
  [46, 30],
  [60, 30],
  [32, 20],
] as const

async function threeCalls($: Engine) {
  await startSession($)
  await startTurn($)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/work/a.ts' } as never)
  await $.tool.call({ tool: 'Edit', tool_use_id: 'u2', file_path: '/work/hooks/studio.tsx' } as never)
  await $.tool.call({ tool: 'Bash', tool_use_id: 'u3', command: 'npm test' } as never)
}

for (const [cols, rows] of SIZES) {
  describe(`${cols} by ${rows}`, () => {
    test('shows a keyframe per call and the stage raster', async ($, on) => {
      answerEngine(on)
      await threeCalls($)
      const ui = await mountPane($, cols, rows)
      expect(await ui.findAll({ type: 'Button', text: '●' })).toHaveLength(3)
      expect((await ui.find({ key: 'stage' }))?.props).toMatchObject({ columns: cols, rows: 12 })
    })

    test('the inspector pins a keyframe and live returns', async ($, on) => {
      answerEngine(on)
      await threeCalls($)
      const ui = await mountPane($, cols, rows)
      await ui.press({ key: 'kf-2' })
      expect(await ui.find({ type: 'Text', text: /Edit.*✓ \d+ ms/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /studio\.tsx/ })).toBeDefined()
      await ui.press({ key: 'live' })
      expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeDefined()
      expect(await ui.find({ key: 'live' })).toBeUndefined()
    })

    test('the scene switcher swaps the stage for Task Manager', async ($, on) => {
      answerEngine(on)
      await threeCalls($)
      const ui = await mountPane($, cols, rows)
      await ui.press({ key: 'scene' })
      expect(await ui.find({ key: 'stage' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: 'Task Manager' })).toBeDefined()
      await ui.press({ key: 'scene' })
      expect(await ui.find({ key: 'stage' })).toBeDefined()
    })
  })
}

test('a pane under 32 columns asks to be widened', async ($, on) => {
  answerEngine(on)
  await threeCalls($)
  const ui = await mountPane($, 31, 30)
  expect(await ui.find({ type: 'Text', text: 'Widen the pane to see the studio.' })).toBeDefined()
  expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
})

test('the ticker repaints the stage', async ($, on) => {
  const { rec, clock } = answerEngine(on)
  await startSession($)
  await mountPane($)
  await clock.advance(166)
  expect(rec.blits.some(blit => blit.key === 'stage')).toBe(true)
})

test('a denied repaint stops until the stage is drawn again', async ($, on) => {
  let deny = true
  const { rec, clock } = answerEngine(on, { blitDeny: key => (deny && key === 'stage' ? 'size' : undefined) })
  await startSession($)
  const ui = await mountPane($)
  await clock.advance(166)
  const denied = rec.blits.filter(blit => blit.key === 'stage').length
  expect(denied).toBe(1)
  await clock.advance(166 * 3)
  expect(rec.blits.filter(blit => blit.key === 'stage')).toHaveLength(denied)
  deny = false
  await ui.redraw()
  await clock.advance(166)
  expect(rec.blits.filter(blit => blit.key === 'stage').length).toBeGreaterThan(denied)
})
