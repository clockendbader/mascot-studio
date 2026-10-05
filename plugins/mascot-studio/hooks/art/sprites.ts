// Original pixel art for Mascot Programming (a grey tabby in a beanie), its
// hats, the mini mascot of the Task Manager graph and the DJ blob. Every
// sprite is a palette-indexed text grid; mascot pose frames are composed from
// the parts below at load, so a head or a prop is drawn once.

import type { Hat, MiniMood, Pose } from '../../types'
import { TRANSPARENT, drawSprite, newGrid } from './pixels'
import type { Grid } from './pixels'

export const PALETTE: Readonly<Record<string, number>> = {
  '.': TRANSPARENT,
  k: 0x1a1a1a, // outline
  g: 0x8c8c8c, // fur
  G: 0xb5b5b5, // light fur
  s: 0x5e5e5e, // stripes
  w: 0xffffff, // white
  p: 0xf2a0b5, // nose
  e: 0x2bb24c, // eyes
  n: 0x3c3c46, // charcoal beanie
  N: 0x5a5a6a, // beanie band
  o: 0xf28c28, // pumpkin
  r: 0xd42a2a, // Santa red
  y: 0xf2d43c, // party yellow
  h: 0xe0457b, // heart
  t: 0x2e2e2e, // tablet
  c: 0x4da3ff, // screen
  m: 0xc8a060, // magnifier rim
  b: 0x3366cc, // globe blue
  l: 0x66cc66, // globe land
  d: 0x7a3fa0, // DJ blob
  D: 0xa060c8, // DJ light
  z: 0x000000, // headphones
}

export type SpriteFrame = { rows: readonly string[]; headY?: number }
type Part = readonly string[]

const SIZE = 24
const HEAD_X = 4
const HEAD_ROWS = 11
const BASE_HEAD_Y = 3

// ── Parts ────────────────────────────────────────────────────────────────

const HEAD_OPEN: Part = [
  '.kk..........kk.',
  '.kpk........kpk.',
  '.kgpkkkkkkkkpgk.',
  'kgggsggggggsgggk',
  'kgggggsggsgggggk',
  'kggekeggggekeggk',
  'kggeeeggggeeeggk',
  'kgGGGGGppGGGGGgk',
  'kGGGGGkGGkGGGGGk',
  '.kGGGGGkkGGGGGk.',
  '..kkkkkkkkkkkk..',
]

const HEAD_CLOSED: Part = HEAD_OPEN.map((row, i) =>
  i === 5 ? 'kggggggggggggggk' : i === 6 ? 'kggkkkggggkkkggk' : row,
)

const BODY: Part = [
  '..kggggggggggk..',
  '.kgggsgGGgsgggk.',
  '.kggsgGGGGgsggk.',
  'kgggsgGGGGgsgggk',
  'kggggGGGGGGggggk',
  'kggsgGGGGGGgsggk',
  'kgggkGGGGGGkgggk',
  'kggkgGGGGGGgkggk',
  'kgkwwkGGGGkwwkgk',
  '.kkkkkkkkkkkkkk.',
]

const TAILS: readonly Part[] = [
  ['..kk', '.kgk', '.kgk', 'kgk.', 'kgk.', 'kgk.', 'kk..'],
  ['.kk.', 'kgk.', 'kgk.', 'kgk.', '.kgk', '.kgk', '..kk'],
]

const QUESTION: Part = ['.kkk.', 'k...k', '....k', '...k.', '..k..', '.....', '..k..']
const PAW: Part = ['.kk.', 'kwwk', 'kwwk']
const PAW3: Part = ['www', 'www']
const STYLUS: Part = ['.k', 'k.']
const TABLET: Part = [
  '.tttttttttttttttttt.',
  'ttcccccccccccccccctt',
  'ttcccccccccccccccctt',
  '.tttttttttttttttttt.',
]
const KEYBOARD: Part = ['kkkkkkkkkkkkkkkkkkkk', 'kwkwkwkwkwkwkwkwkwkk', 'kkkkkkkkkkkkkkkkkkkk']
const MAGNIFIER: Part = ['.mmm...', 'mcccm..', 'mcekm..', 'mcccm..', '.mmmk..', '....kk.', '.....kk']
const GLOBE_MIDDLES = ['blbbb', 'bblbb', 'bbblb', 'lbbbl'] as const
const browserWindow = (middle: string): Part => [
  'kkkkkkkkk',
  'kbbbbbbrk',
  'kwwwwwwwk',
  'kwwbbbwwk',
  `kw${middle}wk`,
  'kwwbbbwwk',
  'kwwwwwwwk',
  'kkkkkkkkk',
]
const TINY_CATS: readonly Part[] = [
  ['k...k', 'koook', 'oeoeo', 'oopoo', '.k.k.'],
  ['k...k', 'koook', 'oeoeo', 'oopoo', 'k...k'],
]
const NOTE: Part = ['.kk', '.k.', 'kk.']
const PALM: Part = ['.ww.', 'wwww', 'wwww']
const ARM: Part = ['gg', 'gg', 'gg', 'gg']
const WAVE_ARM: Part = ['.kk.', 'kwwk', 'kwwk', '.kgk', '.kgk', '.kgk']
const BIG_Z: Part = ['kkkk', '..k.', '.k..', 'kkkk']
const SMALL_Z: Part = ['kkk', '.k.', 'kkk']
const DASHES: Part = ['G.G..G.G']

// ── Composition ──────────────────────────────────────────────────────────

type Layer = { part: Part; x: number; y: number }

function stamp(canvas: string[][], part: Part, x: number, y: number): void {
  part.forEach((row, dy) => {
    ;[...row].forEach((ch, dx) => {
      const line = canvas[y + dy]
      if (ch !== '.' && line !== undefined && x + dx >= 0 && x + dx < line.length) line[x + dx] = ch
    })
  })
}

function pose(headY: number, tick: number, layers: readonly Layer[], head: Part = HEAD_OPEN): SpriteFrame {
  const canvas = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'))
  stamp(canvas, TAILS[tick % 2] ?? [], HEAD_X + 15, headY + 14)
  stamp(canvas, BODY, HEAD_X, headY + HEAD_ROWS)
  stamp(canvas, head, HEAD_X, headY)
  for (const layer of layers) stamp(canvas, layer.part, layer.x, layer.y)
  return { rows: canvas.map(row => row.join('')), headY }
}

const frames = (count: number, make: (f: number) => SpriteFrame): SpriteFrame[] => Array.from({ length: count }, (_, f) => make(f))
const Y = BASE_HEAD_Y

function tabletFrame(f: number): SpriteFrame {
  const penX = [6, 9, 12, 15][f] ?? 6
  const stroke: Part = ['w'.repeat(penX - 3)]
  return pose(Y, f, [
    { part: TABLET, x: 2, y: 20 },
    { part: stroke, x: 4, y: 21 },
    { part: STYLUS, x: penX, y: 19 },
    { part: PAW, x: penX - 2, y: 16 },
  ])
}

export const MASCOT: Readonly<Record<Pose, readonly SpriteFrame[]>> = {
  thinking: frames(2, f => pose(Y, f, [
    { part: QUESTION, x: 19, y: f === 0 ? 1 : 0 },
    { part: PAW, x: 7 + f, y: Y + 9 },
  ])),
  magnify: frames(4, f => {
    const x = [3, 6, 9, 6][f] ?? 3
    return pose(Y, f, [
      { part: MAGNIFIER, x, y: Y + 2 },
      { part: PAW, x: x + 4, y: Y + 7 },
    ])
  }),
  tablet: frames(4, tabletFrame),
  keyboard: frames(2, f => pose(Y, f, [
    { part: KEYBOARD, x: 2, y: 21 },
    { part: PAW3, x: 6, y: f === 0 ? 18 : 19 },
    { part: PAW3, x: 14, y: f === 0 ? 19 : 18 },
  ])),
  browser: frames(4, f => pose(Y, f, [
    { part: browserWindow(GLOBE_MIDDLES[f] ?? 'bbbbb'), x: 15, y: 12 },
    { part: PAW, x: 12, y: 15 },
  ])),
  helper: frames(4, f => pose(Y, f, [
    { part: NOTE, x: 1, y: Y + 4 - (f % 2) },
    { part: TINY_CATS[f % 2] ?? [], x: [22, 20, 18, 17][f] ?? 22, y: 19 },
  ])),
  facepalm: frames(2, f => pose(Y, f, [
    { part: PALM, x: 5 + f, y: Y + 4 },
    { part: ARM, x: 6 + f, y: Y + 7 },
  ])),
  wave: frames(2, f => pose(Y, f, [{ part: WAVE_ARM, x: 18 + f, y: Y + 2 + f }])),
  hop: frames(4, f => {
    const headY = [3, 1, 0, 2][f] ?? 3
    return pose(headY, f, f === 1 || f === 2 ? [{ part: DASHES, x: 8, y: 23 }] : [])
  }),
  asleep: frames(2, f => pose(Y, f, [
    { part: BIG_Z, x: 19, y: f === 0 ? 1 : 0 },
    { part: SMALL_Z, x: 21, y: f === 0 ? 6 : 5 },
  ], HEAD_CLOSED)),
}

const NO_BRIM = '........................'

export const HATS: Readonly<Record<Hat, readonly string[]>> = {
  beanie: [
    '.........nnnnnn.........',
    '........nnnnnnnn........',
    '.......nnnnnnnnnn.......',
    '.....NNNNNNNNNNNNNN.....',
    NO_BRIM, NO_BRIM, NO_BRIM, NO_BRIM,
  ],
  pumpkin: [
    '...........ll...........',
    '........oooooooo........',
    '.......ooookkoooo.......',
    '.....oookoooooookooo....',
    NO_BRIM, NO_BRIM, NO_BRIM, NO_BRIM,
  ],
  santa: [
    '..............rrrww.....',
    '.........rrrrrrrrr......',
    '.......rrrrrrrrrr.......',
    '.....wwwwwwwwwwwwww.....',
    NO_BRIM, NO_BRIM, NO_BRIM, NO_BRIM,
  ],
  party: [
    '...........rr...........',
    '..........yhhy..........',
    '.........yhyyhy.........',
    '........hyyhhyyh........',
    NO_BRIM, NO_BRIM, NO_BRIM, NO_BRIM,
  ],
  heart: [
    '.........nnnnnn.........',
    '........nhhnnhhn........',
    '.......nnhhhhhhnn.......',
    '.....NNNNNNhhNNNNNN.....',
    NO_BRIM, NO_BRIM, NO_BRIM, NO_BRIM,
  ],
}

const MINI_BASE = ['.k....k.', 'kgkkkkgk', 'kggggggk', 'kgeggegk', 'kggppggk', '.kggggk.', '.kgGGgk.', '.kk..kk.'] as const
const withRows = (base: readonly string[], changes: Readonly<Record<number, string>>): string[] =>
  base.map((row, i) => changes[i] ?? row)

export const MINI: Readonly<Record<MiniMood, readonly SpriteFrame[]>> = {
  relaxed: [{ rows: [...MINI_BASE] }, { rows: withRows(MINI_BASE, { 7: '.k.kk.k.' }) }],
  squint: [
    { rows: withRows(MINI_BASE, { 3: 'kgkggkgk' }) },
    { rows: withRows(MINI_BASE, { 3: 'kgkggkgk', 4: 'kggkkggk' }) },
  ],
  sweat: [
    { rows: withRows(MINI_BASE, { 2: 'kggggggc', 4: 'kggkkggk' }) },
    { rows: withRows(MINI_BASE, { 3: 'kgeggegc', 4: 'kggkkggk' }) },
  ],
  flat: [
    { rows: ['........', '........', '.k.k.k.k', '.kgggggk', 'kggggggk', 'kgkggkgk', 'kggggggk', '.kkkkkk.'] },
    { rows: ['........', '........', 'k.k.k.k.', '.kgggggk', 'kggggggk', 'kgkggkgk', 'kggggggk', '.kkkkkk.'] },
  ],
  asleep: [
    { rows: withRows(MINI_BASE, { 0: '.k....kk', 3: 'kkkggkkk' }) },
    { rows: withRows(MINI_BASE, { 0: '.k...k.k', 3: 'kkkggkkk' }) },
  ],
}

const DJ_UP = [
  '..zzzzzz..',
  '.z......z.',
  'zz.dddd.zz',
  'zzdddddDzz',
  '.ddkddkdd.',
  '.dddddddd.',
  '.ddDkkDdd.',
  '.dddddddd.',
  '..dddddd..',
  '..k....k..',
] as const

const DJ_SQUASH = [
  '..........',
  '..zzzzzz..',
  '.z......z.',
  'zzddddddzz',
  'zddkddkddz',
  'dddddddddd',
  '.ddDkkDdd.',
  '.dddddddd.',
  '.dddddddd.',
  '.k......k.',
] as const

export const DJ: Readonly<Record<'dance' | 'sway' | 'doze', readonly SpriteFrame[]>> = {
  dance: [
    { rows: [...DJ_UP] },
    { rows: [...DJ_SQUASH] },
    { rows: withRows(DJ_UP, { 5: 'kddddddddk', 9: '...k..k...' }) },
    { rows: withRows(DJ_SQUASH, { 9: 'k........k' }) },
  ],
  sway: [{ rows: [...DJ_UP] }, { rows: withRows(DJ_UP, { 9: '...k..k...' }) }],
  doze: [
    { rows: withRows(DJ_UP, { 4: '.dkkddkkd.' }) },
    { rows: withRows(DJ_UP, { 1: '.z......zk', 4: '.dkkddkkd.' }) },
  ],
}

export function spriteGrid(rows: readonly string[]): Grid {
  const w = rows[0]?.length ?? 0
  const g = newGrid(w, rows.length, TRANSPARENT)
  rows.forEach((row, y) => {
    ;[...row].forEach((ch, x) => {
      g.px[y * w + x] = PALETTE[ch] ?? TRANSPARENT
    })
  })
  return g
}

/** The 24×24 mascot for a pose at an animation tick, wearing `hat`. */
export function composeMascot(p: Pose, hat: Hat, tick: number): Grid {
  const poseFrames = MASCOT[p]
  const frame = poseFrames[tick % poseFrames.length] ?? poseFrames[0]
  const grid = spriteGrid(frame?.rows ?? [])
  drawSprite(grid, spriteGrid(HATS[hat]), 0, frame?.headY ?? BASE_HEAD_Y)
  return grid
}
