import { test, expect } from 'claude-code/testing'
import { layoutFor } from '../hooks/layout'

test('a tall pane shows every section in full', () => {
  expect(layoutFor(46, 28, 1, true)).toEqual({ tooNarrow: false, menu: true, props: 'full', amp: 'full', tmBoxes: true })
})

test('the sound panel needs six rows for the DJ blob', () => {
  expect(layoutFor(46, 27, 1, true).amp).toBe('line')
})

test('the sound panel folds to one line first', () => {
  expect(layoutFor(46, 23, 1, true)).toMatchObject({ amp: 'line', menu: true, props: 'full' })
})

test('then the menu bar is hidden', () => {
  expect(layoutFor(46, 22, 1, true)).toMatchObject({ amp: 'line', menu: false, props: 'full' })
})

test('then Properties folds to one line', () => {
  expect(layoutFor(46, 21, 1, true)).toMatchObject({ amp: 'line', menu: false, props: 'line' })
})

test('Scene 2 folds its Limits and Totals boxes last', () => {
  expect(layoutFor(46, 22, 2, true)).toMatchObject({ tmBoxes: false })
  expect(layoutFor(46, 31, 2, true)).toMatchObject({ tmBoxes: true, amp: 'full', menu: true })
})

test('a pane under 32 columns is too narrow', () => {
  expect(layoutFor(31, 40, 1, true).tooNarrow).toBe(true)
  expect(layoutFor(32, 40, 1, true).tooNarrow).toBe(false)
})

test('no sound panel leaves no room for one', () => {
  expect(layoutFor(46, 10, 1, false).amp).toBe('none')
  expect(layoutFor(46, 22, 1, false)).toMatchObject({ amp: 'none', menu: true, props: 'full' })
})
