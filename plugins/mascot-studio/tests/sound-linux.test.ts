import { test, expect, describe } from 'claude-code/testing'
import { linuxBackend, parsePlayerctlLine, playerName } from '../hooks/sound/linux'
import type { SoundStatus } from '../types'
import { fakeHost, flush } from './fakes'

const FOLLOW = ['playerctl', '--follow', 'metadata', '--format', '{{status}}\t{{playerName}}\t{{artist}}\t{{title}}\t{{position}}\t{{mpris:length}}']

describe('parsePlayerctlLine', () => {
  test('reads a playing track', () => {
    expect(parsePlayerctlLine('Playing\tspotify\tDaft Punk\tOne More Time')).toEqual({
      kind: 'playing',
      track: { app: 'Spotify', title: 'One More Time', artist: 'Daft Punk' },
    })
  })

  test('reads paused, stopped and no player', () => {
    expect(parsePlayerctlLine('Paused\tfirefox\ta\tb')?.kind).toBe('paused')
    expect(parsePlayerctlLine('Stopped\tvlc\t\t')).toEqual({ kind: 'nothing' })
    expect(parsePlayerctlLine('')).toEqual({ kind: 'nothing' })
  })

  test('keeps a title with a tab whole, the tab drawn as a space', () => {
    expect(parsePlayerctlLine('Playing\tmpv\ta\tpart one\tpart two')).toMatchObject({ track: { title: 'part one part two' } })
  })

  test('ignores a line that is not a status', () => {
    expect(parsePlayerctlLine('Playing\tspotify')).toBeNull()
  })
})

test('playerName turns MPRIS names into app names', () => {
  expect(playerName('vlc')).toBe('VLC')
  expect(playerName('chromium')).toBe('Chromium')
  expect(playerName('spotify.instance123')).toBe('Spotify')
})

test('without playerctl, watch says so and spawns nothing', async () => {
  const fake = fakeHost([], () => Promise.reject(new Error('ENOENT')))
  const statuses: SoundStatus[] = []
  linuxBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(statuses).toEqual([{ kind: 'unavailable', reason: 'missing-playerctl' }])
  expect(fake.spawns()).toBe(0)
})

test('a failing playerctl --version counts as missing', async () => {
  const fake = fakeHost([], () => ({ exitCode: 127, stdout: '', stderr: 'not found' }))
  const statuses: SoundStatus[] = []
  linuxBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(statuses).toEqual([{ kind: 'unavailable', reason: 'missing-playerctl' }])
})

test('with playerctl, watch follows metadata', async () => {
  const fake = fakeHost(['Playing\tspotify\tDaft Punk\tOne More Time\n'], () => ({ exitCode: 0, stdout: 'v2.4.1', stderr: '' }))
  const statuses: SoundStatus[] = []
  const stop = linuxBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(fake.runs[0]).toEqual(['playerctl', '--version'])
  expect(fake.spawned[0]).toEqual(FOLLOW)
  expect(statuses[0]?.kind).toBe('playing')
  stop()
})

test('stopping before the check finishes spawns nothing', async () => {
  const fake = fakeHost([], () => ({ exitCode: 0, stdout: 'v2', stderr: '' }))
  const stop = linuxBackend.watch(fake.host, () => undefined)
  stop()
  await flush()
  expect(fake.spawns()).toBe(0)
})

test('control runs playerctl with the action', async () => {
  const fake = fakeHost([])
  expect(await linuxBackend.control(fake.host, 'previous')).toBe(true)
  expect(await linuxBackend.control(fake.host, 'next')).toBe(true)
  expect(await linuxBackend.control(fake.host, 'play-pause')).toBe(true)
  expect(fake.runs).toEqual([
    ['playerctl', 'previous'],
    ['playerctl', 'next'],
    ['playerctl', 'play-pause'],
  ])
})
