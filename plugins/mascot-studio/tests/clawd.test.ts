import { test, expect, describe } from 'claude-code/testing'
import { POSE_FRAMES, SCENE_H, SCENE_W, sceneFrame } from '../hooks/art/scene'
import { CLAWD_PALETTE } from '../hooks/art/clawd'
import { TRANSPARENT } from '../hooks/art/pixels'
import type { Pose } from '../types'

const POSES = Object.keys(POSE_FRAMES) as Pose[]
const ALLOWED = new Set<number>([...Object.values(CLAWD_PALETTE), TRANSPARENT])
const SCREEN = { x0: 23, y0: 4, x1: 35, y1: 13 }

function screenColours(pose: Pose, tick = 0): Set<number> {
  const g = sceneFrame(pose, 'none', tick)
  const out = new Set<number>()
  for (let y = SCREEN.y0; y <= SCREEN.y1; y++) for (let x = SCREEN.x0; x <= SCREEN.x1; x++) out.add(g.px[y * g.w + x] ?? -1)
  return out
}

test('there are eleven poses with their frame counts', () => {
  expect(POSE_FRAMES).toEqual({
    coding: 8, thinking: 8, reading: 8, terminal: 8, browsing: 8, helper: 8,
    oops: 6, waving: 4, done: 6, idle: 8, asleep: 4,
  })
})

describe('every pose', () => {
  test('draws 40x24 frames in the palette that move from frame to frame', () => {
    for (const pose of POSES) {
      const a = sceneFrame(pose, 'none', 0)
      const b = sceneFrame(pose, 'none', 1)
      expect(a.w).toBe(SCENE_W)
      expect(a.h).toBe(SCENE_H)
      for (const color of a.px) expect(ALLOWED.has(color)).toBe(true)
      expect([...a.px]).not.toEqual([...b.px])
    }
  })

  test('shows Clawd orange', () => {
    for (const pose of POSES) expect([...sceneFrame(pose, 'none', 0).px]).toContain(0xd97757)
  })
})

describe('the laptop screen shows the work', () => {
  test('coding has syntax colours', () => {
    const colours = screenColours('coding')
    expect(colours.has(0xc678dd) || colours.has(0x61afef)).toBe(true)
  })
  test('reading shows a page', () => expect(screenColours('reading').has(0xe8ecf1)).toBe(true))
  test('terminal is black', () => expect(screenColours('terminal').has(0x0b0d10)).toBe(true))
  test('browsing has a blue title strip on its first row', () => {
    const g = sceneFrame('browsing', 'none', 0)
    expect(g.px[SCREEN.y0 * g.w + SCREEN.x0 + 3]).toBe(0x3b7fc4)
  })
  test('oops is red', () => expect(screenColours('oops').has(0xd9534f)).toBe(true))
  test('done is green', () => expect(screenColours('done').has(0x4caf50)).toBe(true))
  test('asleep is dark', () => {
    for (const color of screenColours('asleep')) expect(color === 0x11151c || color === 0x3a3a3a).toBe(true)
  })
})

test('a hat changes only the rows above Clawd', () => {
  const plain = sceneFrame('coding', 'none', 0)
  const pumpkin = sceneFrame('coding', 'pumpkin', 0)
  const rows = new Set<number>()
  for (let i = 0; i < plain.px.length; i++) if (plain.px[i] !== pumpkin.px[i]) rows.add(Math.floor(i / plain.w))
  expect(rows.size).toBeGreaterThan(0)
  for (const row of rows) expect(row).toBeLessThanOrEqual(6)
})

test('the helper pops a mini Clawd up over the laptop', () => {
  const low = sceneFrame('helper', 'none', 0)
  const high = sceneFrame('helper', 'none', 3)
  const orangeAbove = (g: typeof low) => {
    let n = 0
    for (let y = 0; y < 3; y++) for (let x = 24; x < 36; x++) if (g.px[y * g.w + x] === 0xd97757) n++
    return n
  }
  expect(orangeAbove(high)).toBeGreaterThan(orangeAbove(low))
})
