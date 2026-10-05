import { test, expect, describe } from 'claude-code/testing'
import { appScript, choosePlayer, macosBackend, parseAppleScript } from '../hooks/sound/macos'
import type { SoundStatus } from '../types'
import { fakeHost, flush } from './fakes'

const spotify = { app: 'Spotify', title: 'One More Time', artist: 'Daft Punk' }
const music = { app: 'Music', title: 'Clair de Lune', artist: 'Debussy' }

describe('parseAppleScript', () => {
  test('reads a playing track', () => {
    expect(parseAppleScript('Spotify', 'playing\tDaft Punk\tOne More Time\n')).toEqual({ ...spotify, state: 'playing' })
  })

  test('reads stopped as no track', () => {
    expect(parseAppleScript('Spotify', 'stopped\n')).toBeNull()
    expect(parseAppleScript('Spotify', '')).toBeNull()
  })
})

describe('choosePlayer', () => {
  test('a playing app wins', () => {
    expect(choosePlayer([{ ...music, state: 'paused' }, { ...spotify, state: 'playing' }], null)).toEqual({ kind: 'playing', track: spotify })
  })

  test('between paused apps, the one last shown wins', () => {
    expect(choosePlayer([{ ...spotify, state: 'paused' }, { ...music, state: 'paused' }], 'Music')).toEqual({ kind: 'paused', track: music })
  })

  test('no readings is nothing playing', () => {
    expect(choosePlayer([], null)).toEqual({ kind: 'nothing' })
  })
})

function macHost(osascript: (script: string) => { exitCode: number; stdout: string; stderr: string }) {
  return fakeHost([], argv => {
    if (argv[0] === 'pgrep') return { exitCode: argv[2] === 'Spotify' ? 0 : 1, stdout: '', stderr: '' }
    if (argv[0] === 'osascript') return osascript(argv[2] ?? '')
    return { exitCode: 1, stdout: '', stderr: '' }
  })
}

test('polls every two seconds and asks only the running apps', async () => {
  const fake = macHost(() => ({ exitCode: 0, stdout: 'playing\tDaft Punk\tOne More Time\n', stderr: '' }))
  const statuses: SoundStatus[] = []
  const stop = macosBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(fake.timers.find(t => t.repeat)?.ms).toBe(2000)
  expect(fake.runs).toContainEqual(['osascript', '-e', appScript('Spotify')])
  expect(fake.runs).not.toContainEqual(['osascript', '-e', appScript('Music')])
  expect(statuses).toEqual([{ kind: 'playing', track: spotify }])
  stop()
})

test('a refused Automation permission says so', async () => {
  const fake = macHost(() => ({ exitCode: 1, stdout: '', stderr: 'execution error: Not authorized to send Apple events to Spotify. (-1743)' }))
  const statuses: SoundStatus[] = []
  macosBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(statuses).toEqual([{ kind: 'unavailable', reason: 'automation-denied' }])
})

test('the AppleScript never launches an app', () => {
  expect(appScript('Music')).toStartWith('tell application "Music"')
  expect(appScript('Music')).toContain('player state is stopped')
  expect(appScript('Spotify')).toContain('player position')
  expect(appScript('Spotify')).toContain('duration of current track')
})

test('control tells the app shown', async () => {
  const fake = fakeHost([])
  expect(await macosBackend.control(fake.host, 'next', music)).toBe(true)
  expect(await macosBackend.control(fake.host, 'play-pause', spotify)).toBe(true)
  expect(await macosBackend.control(fake.host, 'previous', spotify)).toBe(true)
  expect(fake.runs).toEqual([
    ['osascript', '-e', 'tell application "Music" to next track'],
    ['osascript', '-e', 'tell application "Spotify" to playpause'],
    ['osascript', '-e', 'tell application "Spotify" to previous track'],
  ])
})

test('control refuses an app it does not drive', async () => {
  const fake = fakeHost([])
  expect(await macosBackend.control(fake.host, 'next', { app: 'Evil" to quit', title: '', artist: '' })).toBe(false)
  expect(await macosBackend.control(fake.host, 'next')).toBe(false)
  expect(fake.runs).toEqual([])
})
