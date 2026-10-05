import { test, expect, describe } from 'claude-code/testing'
import { WATCH_SCRIPT, appName, controlScript, encodePowerShell, parseSmtcLine, windowsBackend } from '../hooks/sound/windows'
import { fakeHost, flush } from './fakes'

const PREFIX = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']

describe('parseSmtcLine', () => {
  test('reads no session as nothing playing', () => {
    expect(parseSmtcLine('{"none":true}')).toEqual({ kind: 'nothing' })
  })

  test('reads a playing track', () => {
    expect(parseSmtcLine('{"app":"Spotify.exe","title":"One More Time","artist":"Daft Punk","status":"Playing"}')).toEqual({
      kind: 'playing',
      track: { app: 'Spotify', title: 'One More Time', artist: 'Daft Punk' },
    })
  })

  test('reads paused and stopped', () => {
    expect(parseSmtcLine('{"app":"x","title":"t","artist":"a","status":"Paused"}')?.kind).toBe('paused')
    expect(parseSmtcLine('{"app":"x","title":"t","artist":"a","status":"Stopped"}')).toEqual({ kind: 'nothing' })
  })

  test('keeps non-ASCII titles PowerShell escaped', () => {
    const status = parseSmtcLine('{"app":"x","title":"Beyonc\\u00e9","artist":"a","status":"Playing"}')
    expect(status).toMatchObject({ track: { title: 'Beyoncé' } })
  })

  test('tolerates missing fields', () => {
    expect(parseSmtcLine('{"app":"x","title":null,"artist":null,"status":"Playing"}')).toMatchObject({ track: { title: '', artist: '' } })
  })

  test('ignores anything that is not a status line', () => {
    expect(parseSmtcLine('not json')).toBeNull()
    expect(parseSmtcLine('')).toBeNull()
    expect(parseSmtcLine('[1]')).toBeNull()
  })
})

test('appName turns app ids into names', () => {
  expect(appName('Spotify.exe')).toBe('Spotify')
  expect(appName('chrome')).toBe('Chrome')
  expect(appName('msedge')).toBe('Edge')
  expect(appName('MSEdge')).toBe('Edge')
  expect(appName('firefox')).toBe('Firefox')
  expect(appName('308046B0AF4A39CB')).toBe('Firefox')
  expect(appName('C:\\Apps\\Tidal.exe')).toBe('Tidal')
  expect(appName('Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic')).toBe('Media Player')
  expect(appName('SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify')).toBe('Spotify')
})

test('the scripts force UTF-8 output and call the right transport method', () => {
  expect(WATCH_SCRIPT).toContain('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8')
  expect(controlScript('next')).toContain('TrySkipNextAsync')
  expect(controlScript('previous')).toContain('TrySkipPreviousAsync')
  expect(controlScript('play-pause')).toContain('TryTogglePlayPauseAsync')
})

test('encodePowerShell is base64 of UTF-16LE', () => {
  expect(encodePowerShell('A')).toBe('QQA=')
})

test('watch spawns the encoded watch script and reports what it prints', async () => {
  const fake = fakeHost(['{"none":true}\n'])
  const statuses: unknown[] = []
  const stop = windowsBackend.watch(fake.host, s => statuses.push(s))
  await flush()
  expect(fake.spawned[0]).toEqual([...PREFIX, encodePowerShell(WATCH_SCRIPT)])
  expect(statuses).toEqual([{ kind: 'nothing' }])
  stop()
})

test('control runs the encoded control script and reports success by exit code', async () => {
  let exitCode = 0
  const fake = fakeHost([], () => ({ exitCode, stdout: '', stderr: '' }))
  expect(await windowsBackend.control(fake.host, 'play-pause')).toBe(true)
  expect(fake.runs[0]).toEqual([...PREFIX, encodePowerShell(controlScript('play-pause'))])
  exitCode = 1
  expect(await windowsBackend.control(fake.host, 'next')).toBe(false)
})

test('a transient media-session error does not end the watch loop', () => {
  const loop = WATCH_SCRIPT.slice(WATCH_SCRIPT.indexOf('while ($true) {'))
  expect(loop).toContain('try {')
  expect(loop).toContain('} catch {')
  expect(loop.indexOf('try {')).toBeLessThan(loop.indexOf('GetCurrentSession'))
})

test('the watch script reports the timeline, deduped without the live position', () => {
  expect(WATCH_SCRIPT).toContain('GetTimelineProperties()')
  expect(WATCH_SCRIPT).toContain('LastUpdatedTime')
  expect(WATCH_SCRIPT).toMatch(/\$key -ne \$last/)
})
