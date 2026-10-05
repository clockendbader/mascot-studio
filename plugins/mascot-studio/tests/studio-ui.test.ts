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
      const strip = (await ui.find({ key: 'filmstrip' }))?.props as { props: { clips: unknown[] } }
      expect(strip.props.clips).toHaveLength(3)
      expect((await ui.find({ key: 'stage' }))?.props).toMatchObject({ columns: cols - 2, rows: 12 })
    })

    test('clicking a clip pins it and live returns', async ($, on) => {
      answerEngine(on)
      await threeCalls($)
      const ui = await mountPane($, cols, rows)
      await ui.pointer({ type: 'down', x: 3, y: 0, button: 'left', in: 'filmstrip' })
      expect(await ui.find({ type: 'Text', text: /Step 2 · Edit/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /✓ \d+ ms/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /studio\.tsx/ })).toBeDefined()
      await $.command.run({ command: 'studio', args: 'live' } as never)
      await ui.redraw()
      expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Step \d/ })).toBeUndefined()
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

test('a slow repaint is not stacked up by later ticks', async ($, on) => {
  const { rec, clock } = answerEngine(on, { blitGate: () => new Promise<void>(() => undefined) })
  await startSession($)
  await mountPane($)
  await clock.advance(166 * 5)
  expect(rec.blits).toHaveLength(1)
})
