import { test, expect } from 'claude-code/testing'
import { layoutV2 } from '../hooks/layout'

test('the tab content takes the rows left after chrome, tabs, Stage and status, up to 8', () => {
  expect(layoutV2(46, 24).content).toBe(8)
  expect(layoutV2(46, 30).content).toBe(8)
  expect(layoutV2(46, 22).content).toBe(6)
})

test('the tab content keeps at least 4 rows', () => {
  expect(layoutV2(46, 20).content).toBe(4)
  expect(layoutV2(46, 12).content).toBe(4)
})

test('a pane under 32 columns is too narrow', () => {
  expect(layoutV2(31, 40).tooNarrow).toBe(true)
  expect(layoutV2(32, 40).tooNarrow).toBe(false)
})

test('the Stage takes the width inside a one-column margin', () => {
  expect(layoutV2(60, 24).stageCols).toBe(58)
  expect(layoutV2(46, 24).stageCols).toBe(44)
})
