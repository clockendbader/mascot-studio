import { test, expect } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'
import type { RowSegment } from '../hooks/client/row'
import { answerEngine, mountPane, startSession, waitFor } from './harness'
import type { ProcResult } from './harness'

function linuxRun() {
  return (argv: string[]): ProcResult => {
    if (argv[0] === 'uname') return { exitCode: 0, stdout: 'Linux\n', stderr: '' }
    if (argv[0] === 'playerctl' && argv[1] === '--version') return { exitCode: 0, stdout: 'v2.4.1', stderr: '' }
    return { exitCode: 1, stdout: '', stderr: '' }
  }
}

async function settle(clock: MockClock) {
  await waitFor(clock, () => false)
}

test('without playerctl the Music tab says how to connect', async ($, on) => {
  const { clock } = answerEngine(on, {
    os: 'linux',
    run: argv => (argv[0] === 'uname' ? { exitCode: 0, stdout: 'Linux', stderr: '' } : { exitCode: 127, stdout: '', stderr: '' }),
  })
  await startSession($)
  await settle(clock)
  await $.command.run({ command: 'studio', args: 'music' } as never)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ type: 'Text', text: /Install playerctl to connect music/ })).toBeDefined()
})

test('sound off runs nothing but the OS check and draws no player', { options: { sound: false } }, async ($, on) => {
  const { clock, rec } = answerEngine(on, { os: 'linux', run: linuxRun() })
  await startSession($)
  await settle(clock)
  expect(rec.runs).toEqual([['uname', '-s']])
  expect(rec.spawns).toEqual([])
  await $.command.run({ command: 'studio', args: 'music' } as never)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ key: 'dj' })).toBeUndefined()
  expect(await ui.find({ key: 'music-controls' })).toBeUndefined()
})

test('a helper that keeps failing offers a retry, by click or by /studio retry', async ($, on) => {
  const { clock, rec } = answerEngine(on, { os: 'windows' })
  await startSession($)
  await settle(clock)
  for (const ms of [1000, 2000, 4000, 8000]) {
    await clock.advance(ms)
    await settle(clock)
  }
  expect(rec.spawns).toHaveLength(5)
  await $.command.run({ command: 'studio', args: 'music' } as never)
  const ui = await mountPane($, 46, 32)
  expect(await ui.find({ type: 'Text', text: /stopped after repeated errors/ })).toBeDefined()
  const node = await ui.find({ key: 'music-controls' })
  const segments = (node?.props as { props?: { segments?: RowSegment[] } } | undefined)?.props?.segments ?? []
  const at = segments.findIndex(s => s.id === 'retry')
  expect(at).toBeGreaterThanOrEqual(0)
  const x = segments.slice(0, at).reduce((sum, s) => sum + [...s.text].length, 0)
  await ui.pointer({ type: 'down', x, y: 0, button: 'left', in: 'music-controls' })
  await settle(clock)
  expect(rec.spawns).toHaveLength(6)
  expect(await $.command.run({ command: 'studio', args: 'retry' } as never)).toMatchObject({ text: 'Reconnecting to music.' })
  await settle(clock)
  expect(rec.spawns).toHaveLength(7)
})
