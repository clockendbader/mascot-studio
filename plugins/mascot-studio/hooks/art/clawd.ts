// Clawd, glossy 2010s edition: Claude Code's block critter with rounded
// corners, a highlight, shading and eye glints. Drawn into pixel grids with a
// small character palette, as in the approved mockup (docs/superpowers/mockups/poses.py).

import type { Hat } from '../../types'
import { TRANSPARENT } from './pixels'
import type { Grid } from './pixels'

export const CLAWD_PALETTE: Readonly<Record<string, number>> = {
  o: 0xd97757, // body
  O: 0xeda88c, // highlight
  d: 0xb5553a, // shade
  k: 0x1f1410, // eyes
  w: 0xffffff, // glint
  B: 0x2b2f36, // laptop bezel
  G: 0x8b9096, // laptop body
  g: 0xc9cdd2, // keys
  s: 0x1e2433, // code screen
  S: 0x11151c, // sleeping screen
  K: 0x0b0d10, // terminal screen
  P: 0xc678dd, C: 0x61afef, Y: 0xe5c07b, L: 0x98c379, R: 0xe06c75, T: 0xabb2bf, // syntax
  M: 0x5c6370, // dimmed code
  x: 0xffffff, // white on screens, bubbles
  e: 0xe8ecf1, n: 0x7a8594, // page and its text
  A: 0x3b7fc4, // browser title strip
  E: 0x3366cc, F: 0x66cc66, // globe ocean and land (also the pumpkin stem)
  r: 0xd9534f, // error screen
  v: 0x4caf50, // done screen, sleep light
  q: 0x3a3a3a, // thought ink, Zzz
  u: 0xc8b39a, U: 0x9c8569, // desk
  z: 0xffd54f, // sparkle, key flash
  c: 0x8fd3ff, // sweat drop
  H: 0xf28c28, // pumpkin
  X: 0xd42a2a, // Santa red
  J: 0xf2d43c, // party yellow
  I: 0xe0457b, // heart
}

export function put(g: Grid, x: number, y: number, color: number): void {
  if (x >= 0 && y >= 0 && x < g.w && y < g.h) g.px[y * g.w + x] = color
}

export function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, color: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, color)
}

/** Draws palette-character rows with their top-left at (x, y); `.` leaves the grid as it is. */
export function stamp(g: Grid, rows: readonly string[], x: number, y: number): void {
  rows.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      const color = CLAWD_PALETTE[ch]
      if (ch !== '.' && color !== undefined) put(g, x + dx, y + dy, color)
    })
  })
}

const c = (ch: string): number => CLAWD_PALETTE[ch] ?? TRANSPARENT

const HATS: Readonly<Record<Exclude<Hat, 'none'>, readonly string[]>> = {
  pumpkin: ['.......FF.......', '....HHHHHHHH....', '...HHHqHHqHHH...', '..HHHHHHHHHHHH..'],
  santa: ['..........XXxx..', '......XXXXXX....', '....XXXXXXXX....', '..xxxxxxxxxxxx..'],
  party: ['.......XX.......', '......JIIJ......', '.....JIJJIJ.....', '....IJJIIJJI....'],
  heart: ['.....II.II......', '....IIIIIII.....', '.....IIIII......', '......III.......'],
}

export type Arms = 'none' | 'scratch' | 'facepalm' | 'up' | 'wave-left' | 'wave-right'

export type ClawdOptions = {
  look?: readonly [number, number]
  blink?: boolean
  arms?: Arms
  hat?: Hat
  slump?: boolean
  /** Animation frame, for the head scratch. */
  f?: number
}

/** Clawd's 16x10 body with its top-left at (x0, y0), legs below, arms and hat as asked. */
export function drawClawd(g: Grid, x0: number, y0Base: number, o: ClawdOptions = {}): void {
  const y0 = y0Base + (o.slump === true ? 1 : 0)
  rect(g, x0, y0, x0 + 15, y0 + 9, c('o'))
  for (const [x, y] of [[x0, y0], [x0 + 15, y0], [x0, y0 + 9], [x0 + 15, y0 + 9]] as const) put(g, x, y, TRANSPARENT)
  rect(g, x0 + 1, y0, x0 + 14, y0, c('O'))
  rect(g, x0, y0 + 1, x0, y0 + 4, c('O'))
  rect(g, x0 + 1, y0 + 9, x0 + 14, y0 + 9, c('d'))
  rect(g, x0 + 15, y0 + 5, x0 + 15, y0 + 8, c('d'))
  put(g, x0 + 2, y0 + 1, c('w'))
  const [dx, dy] = o.look ?? [0, 0]
  for (const ex of [x0 + 3, x0 + 11]) {
    if (o.blink === true) {
      rect(g, ex + dx, y0 + 4 + dy, ex + 1 + dx, y0 + 4 + dy, c('k'))
    } else {
      rect(g, ex + dx, y0 + 2 + dy, ex + 1 + dx, y0 + 4 + dy, c('k'))
      put(g, ex + 1 + dx, y0 + 2 + dy, c('w'))
    }
  }
  for (const lx of [x0 + 1, x0 + 4, x0 + 10, x0 + 13]) rect(g, lx, y0 + 10, lx + 1, y0 + 11, c('d'))

  const ay = y0 + 5
  const f = o.f ?? 0
  switch (o.arms ?? 'none') {
    case 'scratch': {
      const hx = x0 + 1 + (f % 3)
      rect(g, x0 - 2, y0 - 2, x0 - 1, ay + 1, c('o'))
      rect(g, x0 - 1, y0 - 2, hx + 2, y0 - 1, c('o'))
      rect(g, hx, y0 - 2, hx + 2, y0 - 2, c('O'))
      if (f % 2 === 0) {
        put(g, hx + 4, y0 - 3, c('q'))
        put(g, hx - 2, y0 - 3, c('q'))
      }
      break
    }
    case 'facepalm':
      rect(g, x0 - 2, y0 + 2, x0 - 1, ay + 1, c('d'))
      rect(g, x0 - 1, y0 + 1, x0 + 7, y0 + 5, c('o'))
      rect(g, x0 - 1, y0 + 1, x0 + 7, y0 + 1, c('O'))
      rect(g, x0 + 7, y0 + 2, x0 + 7, y0 + 5, c('d'))
      break
    case 'up':
      rect(g, x0 - 2, y0 - 3, x0 - 1, ay + 1, c('o'))
      rect(g, x0 + 16, y0 - 3, x0 + 17, ay + 1, c('o'))
      put(g, x0 - 2, y0 - 3, c('O'))
      put(g, x0 + 16, y0 - 3, c('O'))
      break
    case 'wave-left':
    case 'wave-right': {
      const leftUp = o.arms === 'wave-left'
      if (leftUp) {
        rect(g, x0 - 3, y0 - 3, x0 - 2, ay, c('o'))
        put(g, x0 - 3, y0 - 3, c('O'))
        rect(g, x0 + 16, ay, x0 + 18, ay + 1, c('o'))
      } else {
        rect(g, x0 - 3, ay, x0 - 1, ay + 1, c('o'))
        rect(g, x0 + 17, y0 - 3, x0 + 18, ay, c('o'))
        put(g, x0 + 18, y0 - 3, c('O'))
      }
      break
    }
    case 'none':
      break
  }
  if (o.hat !== undefined && o.hat !== 'none') stamp(g, HATS[o.hat], x0, y0 - 4)
}

/** Two outlined hands on the keyboard deck in front of Clawd; typing lifts them in turn and flashes the key. */
export function drawHands(g: Grid, mode: 'type' | 'rest', f: number): void {
  ;[10, 17].forEach((hx, i) => {
    const up = mode === 'type' && f % 2 === i
    stamp(g, ['dOOd', 'dood', '.dd.'], hx, up ? 13 : 14)
    if (mode === 'type' && !up) {
      put(g, hx + 1, 13, c('z'))
      put(g, hx + 2, 12, c('z'))
    }
  })
}

/** An 8x5 mini Clawd (the helper, the screensaver's flyer, the usage graph's climber), one arm waving on odd frames. */
export function drawMiniClawd(g: Grid, x: number, y: number, f: number, mood: 'awake' | 'asleep' | 'sweat' = 'awake'): void {
  rect(g, x + 1, y, x + 6, y + 2, c('o'))
  rect(g, x + 2, y, x + 5, y, c('O'))
  put(g, x + 1, y, TRANSPARENT)
  put(g, x + 6, y, TRANSPARENT)
  rect(g, x + 1, y + 2, x + 6, y + 2, c('d'))
  if (mood === 'asleep') {
    put(g, x + 2, y + 1, c('d'))
    put(g, x + 5, y + 1, c('d'))
    put(g, x + 7, y - 1, c('q'))
  } else {
    rect(g, x + 2, y + 1, x + 2, y + 1, c('k'))
    rect(g, x + 5, y + 1, x + 5, y + 1, c('k'))
  }
  for (const lx of [x + 2, x + 5]) put(g, lx, y + 3, c('d'))
  put(g, x, y + 1, c('o'))
  put(g, x + 7, y + (f % 2 === 0 ? 1 : 0), c('o'))
  if (mood === 'sweat') put(g, x + 7, y - 1, c('c'))
}
