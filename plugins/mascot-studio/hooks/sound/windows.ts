// Windows: the system media session (SMTC), read by a long-lived PowerShell
// helper through WinRT; play/pause/next/previous are one-shot runs.

import type { SoundAction, SoundStatus } from '../../types'
import { lookup, plainText, trackText } from '../text'
import { progressOf } from './progress'
import { watchLines } from './supervisor'
import type { SoundBackend } from './types'

const PREFIX = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand'] as const
const CONTROL_TIMEOUT_MS = 15_000

const PRELUDE = [
  "$ErrorActionPreference = 'Stop'",
  "$ProgressPreference = 'SilentlyContinue'",
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  "$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1",
  'function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }',
  '[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]',
  '$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])',
]

export const WATCH_SCRIPT = [
  ...PRELUDE,
  "$last = ''",
  'while ($true) {',
  '  try {',
  '    $s = $mgr.GetCurrentSession()',
  `    if ($null -eq $s) { $line = '{"none":true}'; $key = 'none' } else {`,
  '      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])',
  '      $st = $s.GetPlaybackInfo().PlaybackStatus.ToString()',
  '      $tl = $s.GetTimelineProperties()',
  '      $pos = $tl.Position.TotalSeconds',
  '      # the position is as of LastUpdatedTime; a playing track has moved on since',
  "      if ($st -eq 'Playing' -and $tl.LastUpdatedTime.Year -gt 2000) { $pos += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds }",
  '      $key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)|$st|$($tl.LastUpdatedTime.UtcTicks)|$($tl.EndTime.Ticks)"',
  '      $line = [pscustomobject]@{ app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist; status = $st; position = [math]::Round($pos, 1); duration = [math]::Round($tl.EndTime.TotalSeconds, 1) } | ConvertTo-Json -Compress',
  '    }',
  '    # a line goes out when the track, the state or the timeline changes, never just because time passed',
  '    if ($key -ne $last) { [Console]::Out.WriteLine($line); [Console]::Out.Flush(); $last = $key }',
  '  } catch {',
  '    # a session that closed mid-read: try again on the next poll',
  '  }',
  '  Start-Sleep -Milliseconds 1000',
  '}',
].join('\n')

const METHODS: Readonly<Record<SoundAction, string>> = {
  'play-pause': 'TryTogglePlayPauseAsync',
  next: 'TrySkipNextAsync',
  previous: 'TrySkipPreviousAsync',
}

export function controlScript(action: SoundAction): string {
  return [...PRELUDE, `$s = $mgr.GetCurrentSession(); if ($null -ne $s) { [void](Await ($s.${METHODS[action]}()) ([bool])) }`].join('\n')
}

/** PowerShell's -EncodedCommand form: the script's UTF-16LE bytes in base64. */
export function encodePowerShell(script: string): string {
  const bytes = new Uint8Array(script.length * 2)
  for (let i = 0; i < script.length; i++) {
    const unit = script.charCodeAt(i)
    bytes[i * 2] = unit & 0xff
    bytes[i * 2 + 1] = unit >> 8
  }
  return bytes.toBase64()
}

const KNOWN_APPS: Readonly<Record<string, string>> = {
  spotify: 'Spotify',
  chrome: 'Chrome',
  msedge: 'Edge',
  firefox: 'Firefox',
  '308046b0af4a39cb': 'Firefox',
  vlc: 'VLC',
  'microsoft.zunemusic': 'Media Player',
  zunemusic: 'Media Player',
}

/** A readable name for a media session's app id (an exe, a hash, or a Store app's `Publisher.App!Id`). */
export function appName(id: string): string {
  let name = id.split(/[\\/]/).pop() ?? id
  if (name.includes('!')) name = name.split('!').pop() ?? name
  name = name.replace(/\.exe$/i, '')
  const known = lookup(KNOWN_APPS, name.toLowerCase())
  if (known !== undefined) return known
  const last = plainText(name.split('.').pop() ?? name)
  return lookup(KNOWN_APPS, last.toLowerCase()) ?? last.charAt(0).toUpperCase() + last.slice(1)
}

const text = (value: unknown) => (typeof value === 'string' ? plainText(value) : '')
const seconds = (value: unknown) => (typeof value === 'number' ? value : Number.NaN)

export function parseSmtcLine(line: string): SoundStatus | null {
  let data: unknown
  try {
    data = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const fields = data as Record<string, unknown>
  if (fields.none === true) return { kind: 'nothing' }
  const track = { app: appName(text(fields.app)), title: trackText(text(fields.title)), artist: trackText(text(fields.artist)) }
  const progress = progressOf(seconds(fields.position), seconds(fields.duration))
  const extra = progress === undefined ? {} : { progress }
  if (fields.status === 'Playing') return { kind: 'playing', track, ...extra }
  if (fields.status === 'Paused') return { kind: 'paused', track, ...extra }
  return { kind: 'nothing' }
}

export const windowsBackend: SoundBackend = {
  watch: (host, onStatus) => watchLines(host, [...PREFIX, encodePowerShell(WATCH_SCRIPT)], parseSmtcLine, onStatus),
  control: async (host, action) => {
    try {
      const done = await host.run([...PREFIX, encodePowerShell(controlScript(action))], CONTROL_TIMEOUT_MS)
      return done.exitCode === 0
    } catch {
      return false
    }
  },
}
