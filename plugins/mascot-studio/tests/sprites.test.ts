import { test, expect, describe } from 'claude-code/testing'
import { DJ, HATS, MASCOT, MINI, PALETTE, composeMascot } from '../hooks/art/sprites'
import type { SpriteFrame } from '../hooks/art/sprites'
import type { Pose } from '../types'

const FRAME_COUNTS: Record<Pose, number> = {
  thinking: 2,
  magnify: 4,
  tablet: 4,
  keyboard: 2,
  browser: 4,
  helper: 4,
  facepalm: 2,
  wave: 2,
  hop: 4,
  asleep: 2,
}

function expectGrid(rows: readonly string[], w: number, h: number) {
  expect(rows).toHaveLength(h)
  for (const row of rows) {
    expect([...row]).toHaveLength(w)
    for (const ch of row) expect(Object.keys(PALETTE)).toContain(ch)
  }
}

describe('frame counts', () => {
  test('each mascot pose has its number of frames', () => {
    for (const [pose, count] of Object.entries(FRAME_COUNTS)) expect(MASCOT[pose as Pose]).toHaveLength(count)
  })

  test('each mini mood has two frames', () => {
    for (const frames of Object.values(MINI)) expect(frames).toHaveLength(2)
  })

  test('the DJ blob dances in four frames and sways and dozes in two', () => {
    expect(DJ.dance).toHaveLength(4)
    expect(DJ.sway).toHaveLength(2)
    expect(DJ.doze).toHaveLength(2)
  })
})

describe('sizes and palette', () => {
  test('mascot frames are 24×24 palette keys with a head position', () => {
    for (const frames of Object.values(MASCOT) as SpriteFrame[][]) {
      for (const frame of frames) {
        expectGrid(frame.rows, 24, 24)
        expect(frame.headY).toBeGreaterThanOrEqual(0)
        expect(frame.headY).toBeLessThanOrEqual(16)
      }
    }
  })

  test('hats are 24 wide and 8 tall', () => {
    for (const rows of Object.values(HATS)) expectGrid(rows, 24, 8)
  })

  test('mini mascot frames are 8×8 and DJ frames 10×10', () => {
    for (const frames of Object.values(MINI)) for (const frame of frames) expectGrid(frame.rows, 8, 8)
    for (const frames of Object.values(DJ)) for (const frame of frames) expectGrid(frame.rows, 10, 10)
  })
})

describe('composeMascot', () => {
  test('is 24×24', () => {
    const g = composeMascot('tablet', 'beanie', 0)
    expect(g.w).toBe(24)
    expect(g.h).toBe(24)
  })

  test('the hat follows the head through a hop', () => {
    for (let tick = 0; tick < 4; tick++) {
      const headY = MASCOT.hop[tick]?.headY ?? -1
      const santa = composeMascot('hop', 'santa', tick)
      const beanie = composeMascot('hop', 'beanie', tick)
      const differingRows = new Set<number>()
      for (let i = 0; i < santa.px.length; i++) if (santa.px[i] !== beanie.px[i]) differingRows.add(Math.floor(i / 24))
      expect(differingRows.size).toBeGreaterThan(0)
      for (const row of differingRows) {
        expect(row).toBeGreaterThanOrEqual(headY)
        expect(row).toBeLessThanOrEqual(headY + 7)
      }
    }
  })

  test('animates: consecutive tablet frames differ', () => {
    expect([...composeMascot('tablet', 'beanie', 0).px]).not.toEqual([...composeMascot('tablet', 'beanie', 1).px])
  })
})
