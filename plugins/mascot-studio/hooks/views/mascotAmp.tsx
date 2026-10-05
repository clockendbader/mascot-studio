import type { Elements } from 'claude-code'

import type { SoundAction, SoundStatus } from '../../types'
import type { RasterFrame } from '../animator'

type Els = Elements['terminal']

export type AmpVM = { cols: number; mode: 'full' | 'line'; status: SoundStatus }
export type AmpActions = { sound(a: SoundAction): void; retrySound(): void }

const EXPLAIN: Readonly<Record<string, string>> = {
  'missing-playerctl': 'Install playerctl to connect music',
  'automation-denied': 'Allow Automation for your terminal in System Settings › Privacy & Security › Automation',
  'unsupported-os': "MascotAmp can't reach a music player on this system",
  stopped: 'MascotAmp stopped after repeated errors',
}

/** The words that replace the LCD, or null when the LCD shows. */
export function explanation(status: SoundStatus): string | null {
  if (status.kind === 'unavailable') return EXPLAIN[status.reason] ?? null
  if (status.kind === 'stopped') return EXPLAIN.stopped ?? null
  return null
}

/** The LCD's marquee for a status, or null when an explanation shows instead. */
export function marqueeOf(status: SoundStatus): string | null {
  if (status.kind === 'playing' || status.kind === 'paused') return `*** ${status.track.title} - ${status.track.artist} ***`
  if (status.kind === 'nothing') return '*** No music playing ***'
  return null
}

function controls(els: Els, status: SoundStatus, act: AmpActions) {
  const { Box, Text, Button } = els
  if (status.kind === 'stopped') {
    return <Button key="retry" plain hotkey="r" label="retry" onPress={() => act.retrySound()} />
  }
  if (status.kind !== 'playing' && status.kind !== 'paused') return null
  return (
    <Box flexDirection="row">
      <Button key="prev" plain hotkey="b" label="◀◀" onPress={() => act.sound('previous')} />
      <Text>{'  '}</Text>
      <Button key="play" plain hotkey="p" label={status.kind === 'playing' ? '❚❚' : '▶'} onPress={() => act.sound('play-pause')} />
      <Text>{'  '}</Text>
      <Button key="next" plain hotkey="n" label="▶▶" onPress={() => act.sound('next')} />
    </Box>
  )
}

/** The MascotAmp panel: the DJ blob, the LCD, the app and spectrum, the transport buttons. */
export function mascotAmpView(els: Els, vm: AmpVM, frames: Readonly<Partial<Record<string, RasterFrame>>>, act: AmpActions) {
  const { Box, Text, Raster } = els
  const raster = (frame: RasterFrame | undefined) =>
    frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
  const { status } = vm
  const words = explanation(status)
  const app = status.kind === 'playing' || status.kind === 'paused' ? status.track.app : ''

  if (vm.mode === 'line') {
    const label =
      status.kind === 'playing' || status.kind === 'paused'
        ? `♪ ${status.track.title} — ${status.track.artist} `
        : `♪ ${words ?? 'No music playing'} `
    return (
      <Box flexDirection="row">
        <Text wrap="truncate-end">{label}</Text>
        {controls(els, status, act)}
      </Box>
    )
  }

  const right = vm.cols - 13
  return (
    <Box flexDirection="row">
      <Text> </Text>
      {raster(frames.dj)}
      <Text>{'  '}</Text>
      <Box flexDirection="column" width={right}>
        {words === null ? raster(frames.lcd) : <Text wrap="wrap">{words}</Text>}
        <Box flexDirection="row">
          <Text wrap="truncate-end">{app.slice(0, Math.max(0, right - 18)).padEnd(Math.max(0, right - 17))}</Text>
          {raster(frames.viz)}
        </Box>
        {controls(els, status, act)}
      </Box>
    </Box>
  )
}
