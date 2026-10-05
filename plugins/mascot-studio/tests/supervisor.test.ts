import { test, expect, describe } from 'claude-code/testing'
import { detectOs } from '../hooks/sound/platform'
import { LineBuffer, backoffDelay, watchLines } from '../hooks/sound/supervisor'
import { fakeHost, flush } from './fakes'
import type { SoundStatus } from '../types'

describe('detectOs', () => {
  test('trusts the Windows environment without asking uname', async () => {
    let asked = false
    expect(await detectOs('Windows_NT', async () => ((asked = true), ''))).toBe('windows')
    expect(asked).toBe(false)
  })

  test('reads uname elsewhere', async () => {
    expect(await detectOs(undefined, async () => 'Darwin\n')).toBe('macos')
    expect(await detectOs(undefined, async () => 'Linux')).toBe('linux')
    expect(await detectOs(undefined, async () => 'FreeBSD')).toBe('other')
  })

  test('falls back to other when uname fails', async () => {
    expect(await detectOs(undefined, async () => Promise.reject(new Error('no uname')))).toBe('other')
  })
})

test('LineBuffer returns whole lines and keeps the rest', () => {
  const buffer = new LineBuffer()
  expect(buffer.push('a\r\nb')).toEqual(['a'])
  expect(buffer.push('c\n')).toEqual(['bc'])
})

describe('backoffDelay', () => {
  test('doubles from one second', () => {
    expect(backoffDelay([0], 0)).toBe(1000)
    expect(backoffDelay([0, 1], 1)).toBe(2000)
    expect(backoffDelay([0, 1, 2], 2)).toBe(4000)
    expect(backoffDelay([0, 1, 2, 3], 3)).toBe(8000)
  })

  test('stops after five failures within two minutes', () => {
    expect(backoffDelay([0, 1000, 3000, 7000, 15000], 15000)).toBe('stop')
  })

  test('keeps trying slowly when failures are spread out', () => {
    const spread = [0, 150_000, 300_000, 450_000, 600_000]
    expect(backoffDelay(spread, 600_000)).toBe(16000)
    expect(backoffDelay([...spread, 750_000], 750_000)).toBe(60000)
  })
})

describe('watchLines', () => {
  test('parses each line and restarts an exited helper after a second', async () => {
    const fake = fakeHost(['{"x":1}\n'])
    const seen: string[] = []
    watchLines(fake.host, ['helper'], line => (seen.push(line), { kind: 'nothing' }), () => undefined)
    await flush()
    expect(seen).toEqual(['{"x":1}'])
    expect(fake.timers.at(-1)?.ms).toBe(1000)
    await fake.fire()
    expect(fake.spawns()).toBe(2)
  })

  test('reports stopped after five quick exits', async () => {
    const fake = fakeHost([])
    const statuses: SoundStatus[] = []
    watchLines(fake.host, ['helper'], () => null, s => statuses.push(s))
    await flush()
    for (let i = 0; i < 4; i++) {
      fake.tick(100)
      await fake.fire()
    }
    expect(statuses).toEqual([{ kind: 'stopped' }])
    expect(fake.spawns()).toBe(5)
  })

  test('the stop function prevents further restarts', async () => {
    const fake = fakeHost([])
    const stop = watchLines(fake.host, ['helper'], () => null, () => undefined)
    await flush()
    stop()
    await fake.fire()
    expect(fake.spawns()).toBe(1)
  })

  test('a helper that ran a minute starts the failure count over', async () => {
    const fake = fakeHost([])
    watchLines(fake.host, ['helper'], () => null, () => undefined)
    await flush()
    await fake.fire()
    await fake.fire()
    expect(fake.timers.at(-1)?.ms).toBe(4000)
    fake.runFor(60_000)
    await fake.fire()
    expect(fake.timers.at(-1)?.ms).toBe(1000)
  })
})
