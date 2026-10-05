// The Stage scene: Clawd behind a desk at a laptop whose screen shows the
// work. One function per pose, each a looping animation; ported from the
// approved mockup (docs/superpowers/mockups/poses.py) plus four new poses.

import type { Hat, Pose } from '../../types'
import { TRANSPARENT, newGrid } from './pixels'
import type { Grid } from './pixels'
import { CLAWD_PALETTE, drawClawd, drawHands, drawMiniClawd, put, rect, stamp } from './clawd'

export const SCENE_W = 40
export const SCENE_H = 24

export const POSE_FRAMES: Readonly<Record<Pose, number>> = {
  coding: 8,
  thinking: 8,
  reading: 8,
  terminal: 8,
  browsing: 8,
  helper: 8,
  oops: 6,
  waving: 4,
  done: 6,
  idle: 8,
  asleep: 4,
}

const c = (ch: string): number => CLAWD_PALETTE[ch] ?? TRANSPARENT
const SX0 = 23
const SY0 = 4
const SX1 = 35
const SY1 = 13

function deskAndLaptop(g: Grid, screen: string): void {
  rect(g, 0, 19, SCENE_W - 1, 19, c('u'))
  rect(g, 0, 20, SCENE_W - 1, 20, c('U'))
  rect(g, 22, 3, 36, 14, c('B'))
  rect(g, SX0, SY0, SX1, SY1, c(screen))
  rect(g, 24, 15, 34, 15, c('G'))
  rect(g, 9, 16, 37, 17, c('g'))
  for (let kx = 10; kx < 37; kx += 2) put(g, kx, 16, c('G'))
  rect(g, 8, 18, 38, 18, c('G'))
}

const CODE_RUNS = ['PPCCC', '.YYYTT', '..LLLLL', '.CCRR', 'PPPTYY', '..TTTLLL', '.RRCCC', 'TT']

function drawCode(g: Grid, frame: number, cursor: boolean, dim = false): void {
  const typed = Array.from({ length: frame + 4 }, (_, i) => CODE_RUNS[i % CODE_RUNS.length] ?? '')
  const lines = typed.slice(-5)
  lines.forEach((run, i) => {
    const y = SY0 + 1 + i * 2
    ;[...run].forEach((ch, j) => {
      if (ch !== '.') put(g, SX0 + 1 + j, y, dim ? c('M') : c(ch))
    })
    if (i === lines.length - 1 && cursor && frame % 2 === 0) put(g, SX0 + 2 + run.length, y, c('x'))
  })
}

function drawDoc(g: Grid, frame: number): void {
  const lengths = [11, 8, 10, 6, 11, 7, 9, 5, 11, 8, 4, 10]
  for (let i = 0; i < 10; i++) {
    if ((i + frame) % 3 === 2) continue
    const n = lengths[(i + frame) % lengths.length] ?? 6
    rect(g, SX0 + 1, SY0 + i, SX0 + n, SY0 + i, i === 4 ? c('Y') : c('n'))
  }
}

function drawTerminal(g: Grid, frame: number): void {
  const out = Array.from({ length: frame + 5 }, (_, i) => (i % 3 === 0 ? { prompt: true, n: 2 + (i % 4) } : { prompt: false, n: 3 + ((i * 3) % 8) }))
  out.slice(-5).forEach((line, i) => {
    const y = SY0 + i * 2
    if (line.prompt) {
      put(g, SX0 + 1, y, c('L'))
      rect(g, SX0 + 3, y, SX0 + 2 + line.n, y, c('x'))
    } else {
      rect(g, SX0 + 1, y, SX0 + line.n, y, c('T'))
    }
  })
}

function drawBrowser(g: Grid, frame: number): void {
  rect(g, SX0, SY0, SX1, SY0 + 1, c('A'))
  put(g, SX1 - 1, SY0, c('x'))
  const globe = ['.EEE.', 'EEEEE', 'EEEEE', 'EEEEE', '.EEE.']
  stamp(g, globe, SX0 + 1, SY0 + 3)
  for (let row = 1; row <= 3; row++) put(g, SX0 + 2 + ((frame + row) % 3), SY0 + 3 + row, c('F'))
  for (const [y, n] of [[SY0 + 3, 5], [SY0 + 5, 4], [SY0 + 7, 5], [SY0 + 9, 3]] as const) rect(g, SX0 + 8, y, SX0 + 7 + n, y, c('n'))
}

const ERROR_X = ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x']
const CHECK = ['.....x', '....xx', 'x..xx.', 'xxxx..', '.xx...']
const SPARK = ['.z.', 'zzz', '.z.']
const THOUGHT = ['.xxxxxxxxxx.', 'xxxxxxxxxxxx', 'xxxxxxxxxxxx', '.xxxxxxxxxx.']
const CHAT = ['.xxxxxxx.', 'xxxxxxxxx', 'xqxxqxxqx', 'xxxxxxxxx', '.xxxxxxx.', '.x.......']

type Draw = (g: Grid, f: number, hat: Hat) => void

const POSES: Readonly<Record<Pose, Draw>> = {
  coding: (g, f, hat) => {
    const bob = f % 4 === 1 || f % 4 === 2 ? -1 : 0
    drawClawd(g, 4, 5 + bob, { look: [1, 1], blink: f === 5, hat })
    deskAndLaptop(g, 's')
    drawHands(g, 'type', f)
    drawCode(g, f, true)
  },
  thinking: (g, f, hat) => {
    drawClawd(g, 4, 6, { look: [1, -1], arms: 'scratch', f, hat })
    deskAndLaptop(g, 's')
    stamp(g, ['dOOd', 'dood', '.dd.'], 17, 14)
    drawCode(g, 3, f % 2 === 0)
    stamp(g, THOUGHT, 9, 0)
    put(g, 21, 2, c('x'))
    if (f % 8 < 6) {
      for (let i = 0; i < f % 4; i++) rect(g, 11 + i * 3, 1, 12 + i * 3, 2, c('q'))
    } else {
      stamp(g, ['qq.', '..q', '.q.'], 14, 0)
    }
  },
  reading: (g, f, hat) => {
    drawClawd(g, 4, 5, { look: [1, 0], blink: f === 6, hat })
    deskAndLaptop(g, 'e')
    drawHands(g, 'rest', f)
    drawDoc(g, f)
  },
  terminal: (g, f, hat) => {
    drawClawd(g, 4, 5, { look: [1, f % 4 < 2 ? 1 : 0], hat })
    deskAndLaptop(g, 'K')
    drawHands(g, 'type', Math.floor(f / 2))
    drawTerminal(g, f)
  },
  browsing: (g, f, hat) => {
    drawClawd(g, 4, 5, { look: [1, 0], blink: f === 7, hat })
    deskAndLaptop(g, 'x')
    drawHands(g, 'rest', f)
    drawBrowser(g, f)
  },
  helper: (g, f, hat) => {
    const rise = [4, 2, 0, 0, 0, 0, 1, 0][f] ?? 0
    drawMiniClawd(g, 26, rise, f)
    drawClawd(g, 4, 5, { look: [1, -1], hat })
    deskAndLaptop(g, 's')
    rect(g, 22, 3, 36, 3, c('B'))
    if (rise > 0) rect(g, 23, SY0, SX1, Math.min(SY1, rise + 3), c('s'))
    drawHands(g, 'type', f)
    drawCode(g, f, true)
  },
  oops: (g, f, hat) => {
    drawClawd(g, 4 + (f % 2), 5, { arms: 'facepalm', hat })
    deskAndLaptop(g, 'r')
    stamp(g, ['dOOd', 'dood', '.dd.'], 17, 14)
    stamp(g, ERROR_X, 27, 6)
    if (f % 4 < 2) {
      put(g, 21, 3, c('c'))
      put(g, 21, 4, c('c'))
    }
  },
  waving: (g, f, hat) => {
    drawClawd(g, 4, 5, { arms: f % 2 === 0 ? 'wave-left' : 'wave-right', hat })
    deskAndLaptop(g, 's')
    stamp(g, CHAT, 25, 6)
  },
  done: (g, f, hat) => {
    const hop = [0, -2, -3, -2, 0, 0][f] ?? 0
    drawClawd(g, 4, 5 + hop, { arms: hop < 0 ? 'up' : 'none', hat })
    deskAndLaptop(g, 'v')
    if (hop === 0) drawHands(g, 'rest', f)
    stamp(g, CHECK, 26, 6)
    if (hop < 0) {
      stamp(g, SPARK, 0, 1 + (f % 2))
      stamp(g, SPARK, 20, (f + 1) % 2)
    }
  },
  idle: (g, f, hat) => {
    drawClawd(g, 4, 5, { look: [1, f % 8 < 4 ? 0 : 1], blink: f === 7, hat })
    deskAndLaptop(g, 's')
    drawHands(g, 'rest', f)
    drawCode(g, 4, f % 2 === 0, true)
  },
  asleep: (g, f, hat) => {
    drawClawd(g, 4, 5, { blink: true, slump: true, hat })
    deskAndLaptop(g, 'S')
    drawHands(g, 'rest', f)
    stamp(g, ['qqq', '.q.', 'qqq'], 15, 2 - (f % 2))
    if (f % 4 < 2) stamp(g, ['qq', 'qq'], 19, 0)
    if (f % 2 === 0) put(g, 30, 18, c('v'))
  },
}

/** One frame of a pose, 40x24 px, transparent where the theme's backdrop shows. */
export function sceneFrame(pose: Pose, hat: Hat, tick: number): Grid {
  const g = newGrid(SCENE_W, SCENE_H, TRANSPARENT)
  POSES[pose](g, tick % POSE_FRAMES[pose], hat)
  return g
}
