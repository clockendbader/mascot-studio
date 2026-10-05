import { test, expect, describe } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import { djCells, progressCells } from '../hooks/art/instruments'
import { parseSmtcLine } from '../hooks/sound/windows'
import { parsePlayerctlLine } from '../hooks/sound/linux'
import { parseAppleScript } from '../hooks/sound/macos'
import type { RowSegment } from '../hooks/client/row'
import { THEMES } from '../hooks/themes'
import { answerEngine, mountPane, startSession, waitFor } from './harness'
import type { ProcResult, Recorder } from './harness'
import { channel } from './fakes'
import { decode } from './cells'

const text = (cells: string) =>
  decode(cells)
    .filter((_, i) => i % 3 === 0)
    .map(cp => String.fromCodePoint(cp))
    .join('')

describe('players report position and duration', () => {
  test('Windows', () => {
    const s = parseSmtcLine('{"app":"Spotify.exe","title":"T","artist":"A","status":"Playing","position":72.4,"duration":185}')
    expect(s).toMatchObject({ kind: 'playing', progress: { position: 72.4, duration: 185 } })
  })

  test('Linux, in microseconds, a title with a tab kept whole (the tab drawn as a space)', () => {
    const s = parsePlayerctlLine('Playing\tspotify\tA\tPart one\tPart two\t72400000\t185000000')
    expect(s).toMatchObject({ kind: 'playing', track: { title: 'Part one Part two' }, progress: { position: 72.4, duration: 185 } })
  })

  test('macOS, Spotify in milliseconds and a comma decimal', () => {
    expect(parseAppleScript('Spotify', 'playing\tA\tT\t72,4\t185000')).toMatchObject({ progress: { position: 72.4, duration: 185 } })
    expect(parseAppleScript('Music', 'paused\tA\tT\t10\t200.5')).toMatchObject({ progress: { position: 10, duration: 200.5 } })
  })

  test('bad or missing numbers give no progress', () => {
    for (const line of [
      '{"app":"x","title":"T","artist":"A","status":"Playing"}',
      '{"app":"x","title":"T","artist":"A","status":"Playing","position":1,"duration":0}',
      '{"app":"x","title":"T","artist":"A","status":"Playing","position":-1,"duration":10}',
      '{"app":"x","title":"T","artist":"A","status":"Playing","position":"1","duration":"10"}',
    ]) {
      expect(parseSmtcLine(line)).not.toHaveProperty('progress')
    }
    expect(parsePlayerctlLine('Playing\tspotify\tA\tT')).not.toHaveProperty('progress')
    expect(parsePlayerctlLine('Playing\tchromium\tA\tT\t\t')).not.toHaveProperty('progress')
    expect(parseAppleScript('Music', 'playing\tA\tT\tnan\t')).not.toHaveProperty('progress')
  })
})

describe('progressCells', () => {
  const theme = THEMES.windows7

  test('advances while playing', () => {
    expect(text(progressCells({ position: 72, duration: 185, at: 0 }, true, 10_000, 30, theme))).toContain('1:22')
  })

  test('holds while paused', () => {
    expect(text(progressCells({ position: 72, duration: 185, at: 0 }, false, 10_000, 30, theme))).toContain('1:12')
  })

  test('never runs past the end', () => {
    expect(text(progressCells({ position: 180, duration: 185, at: 0 }, true, 60_000, 30, theme))).toContain('3:05')
  })

  test('shows the length of the track and fills its columns', () => {
    const shown = text(progressCells({ position: 0, duration: 3725, at: 0 }, false, 0, 30, theme))
    expect(shown).toHaveLength(30)
    expect(shown).toContain('1:02:05')
  })

  test('shows no numbers without progress', () => {
    const shown = text(progressCells(null, true, 0, 30, theme))
    expect(shown).not.toMatch(/\d/)
    expect(shown).toHaveLength(30)
  })
})

describe('the DJ blob', () => {
  test('is 10 by 5 cells and dances', () => {
    expect(decode(djCells('dance', 0))).toHaveLength(10 * 5 * 3)
    expect(djCells('dance', 0)).not.toBe(djCells('dance', 1))
  })

  test('stands on the panel colour it is given', () => {
    const colors = decode(djCells('doze', 0, 0x16202b)).filter((_, i) => i % 3 !== 0)
    expect(colors).toContain(0x16202b)
    expect(colors).not.toContain(0x01000000)
  })
})

const SONG = 'Playing\tspotify\tDaft Punk\tOne More Time\t72000000\t320000000\n'

function linuxRun(controlExit = 0) {
  return (argv: string[]): ProcResult => {
    if (argv[0] === 'uname') return { exitCode: 0, stdout: 'Linux\n', stderr: '' }
    if (argv[0] === 'playerctl' && argv[1] === '--version') return { exitCode: 0, stdout: 'v2.4.1', stderr: '' }
    if (argv[0] === 'playerctl') return { exitCode: controlExit, stdout: '', stderr: '' }
    return { exitCode: 1, stdout: '', stderr: '' }
  }
}

const spawnFrom = (lines: ReturnType<typeof channel<string>>) => () =>
  (async function* () {
    for await (const t of lines.read()) yield { stream: 'stdout' as const, text: t }
  })()

/** Lets the plugin take what is under way a few steps further (waitFor's 200 settles are slow while the player stream is open). */
async function settle(clock: MockClock): Promise<void> {
  for (let i = 0; i < 8; i++) await clock.settle()
}

/** Starts a session, feeds the player one line and opens the Music tab once the helper has read it. */
async function musicTab($: Engine, clock: MockClock, rec: Recorder, lines: ReturnType<typeof channel<string>>, rows = 24, line = SONG) {
  await startSession($)
  await waitFor(clock, () => rec.spawns.length > 0)
  lines.push(line)
  await waitFor(clock, () => lines.pending() === 0)
  await settle(clock)
  await $.command.run({ command: 'studio', args: 'music' } as never)
  return mountPane($, 46, rows)
}

type Mounted = Awaited<ReturnType<typeof mountPane>>

/** Clicks the segment with this id in a Client row. */
async function click(ui: Mounted, key: string, id: string): Promise<void> {
  const node = await ui.find({ key })
  const segments = (node?.props as { props?: { segments?: RowSegment[] } } | undefined)?.props?.segments ?? []
  const at = segments.findIndex(s => s.id === id)
  if (at < 0) throw new Error(`${id} not in ${key}`)
  const x = segments.slice(0, at).reduce((sum, s) => sum + [...s.text].length, 0)
  await ui.pointer({ type: 'down', x, y: 0, button: 'left', in: key })
}

test('the Music tab shows the song, the DJ blob, progress and controls', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines)
  expect(await ui.find({ type: 'Text', text: /One More Time/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Daft Punk/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Now playing · Spotify/ })).toBeDefined()
  expect(await ui.find({ key: 'dj' })).toBeDefined()
  expect(await ui.find({ key: 'progress' })).toBeDefined()
  expect(await ui.find({ key: 'music-controls' })).toBeDefined()
})

test('a short pane drops the DJ blob but keeps progress and controls', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines, 21)
  expect(await ui.find({ key: 'dj' })).toBeUndefined()
  expect(await ui.find({ key: 'progress' })).toBeDefined()
  expect(await ui.find({ key: 'music-controls' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /One More Time/ })).toBeDefined()
})

test('clicking skip runs playerctl next; /studio play and back drive the player', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines)
  await click(ui, 'music-controls', 'skip')
  await waitFor(clock, () => rec.runs.some(argv => argv[1] === 'next'))
  expect(rec.runs).toContainEqual(['playerctl', 'next'])
  await $.command.run({ command: 'studio', args: 'play' } as never)
  expect(rec.runs).toContainEqual(['playerctl', 'play-pause'])
  await $.command.run({ command: 'studio', args: 'back' } as never)
  expect(rec.runs).toContainEqual(['playerctl', 'previous'])
})

test('a failed control says it could not reach the player', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(1), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines)
  await click(ui, 'music-controls', 'skip')
  await waitFor(clock, () => rec.toasts.length > 0)
  expect(rec.toasts).toContain("Couldn't reach Spotify")
  expect(await $.command.run({ command: 'studio', args: 'skip' } as never)).toMatchObject({ text: "Couldn't reach Spotify." })
})

test('with nothing playing the tab says so and offers no controls', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines, 24, '\n')
  expect(await ui.find({ type: 'Text', text: /No music playing/ })).toBeDefined()
  expect(await ui.find({ key: 'dj' })).toBeDefined()
  expect(await ui.find({ key: 'music-controls' })).toBeUndefined()
})

test('with sound off the tab says how to turn it on and nothing runs', { options: { sound: false } }, async ($, on) => {
  const { rec } = answerEngine(on, { os: 'linux', run: linuxRun() })
  await startSession($)
  await $.command.run({ command: 'studio', args: 'music' } as never)
  const ui = await mountPane($, 46, 24)
  expect(await ui.find({ type: 'Text', text: /Music is off\. Turn it on with \/plugin configure\./ })).toBeDefined()
  expect(rec.spawns).toEqual([])
  expect(await $.command.run({ command: 'studio', args: 'play' } as never)).toMatchObject({ text: 'Music is off. Turn it on with /plugin configure.' })
})

test('every Music tab text sets its colour', async ($, on) => {
  const lines = channel<string>()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: spawnFrom(lines) })
  const ui = await musicTab($, clock, rec, lines)
  let texts = 0
  const walk = (n: unknown): void => {
    if (typeof n !== 'object' || n === null) return
    const node = n as { type?: string; props?: { color?: string }; children?: unknown[] }
    if (node.type === 'Text') {
      texts += 1
      expect(node.props?.color).toBeDefined()
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(await ui.find({ key: 'tab-content' }))
  expect(texts).toBeGreaterThan(0)
})
