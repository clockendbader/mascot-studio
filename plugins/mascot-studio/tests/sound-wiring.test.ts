import { test, expect } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'
import { answerEngine, mountPane, startSession, waitFor } from './harness'
import type { ProcResult } from './harness'
import { channel } from './fakes'

const SONG_1 = 'Playing\tspotify\tDaft Punk\tOne More Time\n'
const SONG_2 = 'Playing\tspotify\tDaft Punk\tAerodynamic\n'

function linuxRun(controlExit = 0) {
  return (argv: string[]): ProcResult => {
    if (argv[0] === 'uname') return { exitCode: 0, stdout: 'Linux\n', stderr: '' }
    if (argv[0] === 'playerctl' && argv[1] === '--version') return { exitCode: 0, stdout: 'v2.4.1', stderr: '' }
    if (argv[0] === 'playerctl') return { exitCode: controlExit, stdout: '', stderr: '' }
    return { exitCode: 1, stdout: '', stderr: '' }
  }
}

function player() {
  const lines = channel<string>()
  return {
    lines,
    spawn: () => (async function* () {
      for await (const text of lines.read()) yield { stream: 'stdout' as const, text }
    })(),
  }
}

async function settle(clock: MockClock) {
  await waitFor(clock, () => false)
}

async function playing($: Engine, clock: MockClock, feed: ReturnType<typeof player>) {
  await startSession($)
  await settle(clock)
  feed.lines.push(SONG_1)
  await settle(clock)
}

test('a playing track shows in MascotAmp with its controls', async ($, on) => {
  const feed = player()
  const { clock } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: feed.spawn })
  await playing($, clock, feed)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ type: 'Text', text: /Spotify/ })).toBeDefined()
  for (const key of ['lcd', 'viz', 'dj', 'prev', 'play', 'next']) expect(await ui.find({ key })).toBeDefined()
})

test('a new track adds a Sound-layer keyframe at the current frame', async ($, on) => {
  const feed = player()
  const { clock } = answerEngine(on, { os: 'linux', run: linuxRun(), spawn: feed.spawn })
  await playing($, clock, feed)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a' } as never)
  await $.tool.call({ tool: 'Read', tool_use_id: 'u2', file_path: '/b' } as never)
  const before = await mountPane($, 46, 32)
  expect(await before.findAll({ type: 'Text', text: '●' })).toHaveLength(0)
  await before.unmount()
  feed.lines.push(SONG_2)
  await settle(clock)
  const after = await mountPane($, 46, 32)
  expect(await after.findAll({ type: 'Text', text: '●' })).toHaveLength(1)
})

test('the controls run playerctl and a failure is toasted', async ($, on) => {
  const feed = player()
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun(1), spawn: feed.spawn })
  await playing($, clock, feed)
  const ui = await mountPane($, 46, 32)
  await ui.press({ key: 'next' })
  expect(rec.runs).toContainEqual(['playerctl', 'next'])
  expect(rec.toasts).toContain("MascotAmp couldn't reach Spotify")
})

test('without playerctl the panel says how to connect', async ($, on) => {
  const { clock } = answerEngine(on, {
    os: 'linux',
    run: argv => (argv[0] === 'uname' ? { exitCode: 0, stdout: 'Linux', stderr: '' } : { exitCode: 127, stdout: '', stderr: '' }),
  })
  await startSession($)
  await settle(clock)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ type: 'Text', text: /Install playerctl to connect music/ })).toBeDefined()
})

test('sound off runs nothing and draws no panel', { options: { sound: false } }, async ($, on) => {
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun() })
  await startSession($)
  await settle(clock)
  expect(rec.runs).toEqual([])
  expect(rec.spawns).toEqual([])
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ type: 'Text', text: /MascotAmp/ })).toBeUndefined()
})

test('a helper that keeps failing offers a retry', async ($, on) => {
  const { clock, rec } = answerEngine(on, { os: 'windows' })
  await startSession($)
  await settle(clock)
  for (const ms of [1000, 2000, 4000, 8000]) {
    await clock.advance(ms)
    await settle(clock)
  }
  expect(rec.spawns).toHaveLength(5)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ key: 'retry' })).toBeDefined()
  await ui.press({ key: 'retry' })
  await settle(clock)
  expect(rec.spawns).toHaveLength(6)
})
