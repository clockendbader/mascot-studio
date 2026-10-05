import type { Scene } from '../types'

export type Layout = {
  tooNarrow: boolean
  menu: boolean
  props: 'full' | 'line'
  amp: 'full' | 'line' | 'none'
  tmBoxes: boolean
}

export const MIN_COLS = 32

const HEIGHT = {
  menu: 1,
  timeline: 5,
  stage: { 1: 13, 2: 16 },
  tmBoxes: 5,
  props: { full: 3, line: 2 },
  amp: { full: 4, line: 1, none: 0 },
} as const

function heightOf(l: Layout, scene: Scene): number {
  return (
    (l.menu ? HEIGHT.menu : 0) +
    HEIGHT.timeline +
    HEIGHT.stage[scene] -
    (scene === 2 && !l.tmBoxes ? HEIGHT.tmBoxes : 0) +
    HEIGHT.props[l.props] +
    HEIGHT.amp[l.amp]
  )
}

/** Which sections fit, folding the sound panel, then the menu bar, then Properties, then Scene 2's boxes. */
export function layoutFor(cols: number, rows: number, scene: Scene, amp: boolean): Layout {
  const l: Layout = { tooNarrow: cols < MIN_COLS, menu: true, props: 'full', amp: amp ? 'full' : 'none', tmBoxes: true }
  if (heightOf(l, scene) > rows && l.amp === 'full') l.amp = 'line'
  if (heightOf(l, scene) > rows) l.menu = false
  if (heightOf(l, scene) > rows) l.props = 'line'
  if (scene === 2 && heightOf(l, scene) > rows) l.tmBoxes = false
  return l
}
