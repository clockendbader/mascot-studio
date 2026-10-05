// A surface module: the Timeline's film strip, drawn with `▀` cells (top
// pixel in the foreground colour, bottom pixel in the background). Film with
// sprocket holes runs above and below; each step is a one-cell clip in its
// colour, a gap between clips, the playhead after the newest. A left click
// on a clip posts `{ pick: n }`; the hovered and the selected clip get their
// film marked.

import type { ClientSurface } from 'claude-code'

export type FilmClip = { n: number; color: string }

export type FilmstripProps = {
  clips: FilmClip[]
  current: number
  selected: number | null
  width: number
  film: string
  hole: string
  gap: string
  playhead: string
  mark: string
}

type StripState = { hover: number | null }

/** Which clip sits under column x: clip i takes column 1 + 2i, its gap the column after. */
export function clipAt(x: number, count: number): number | null {
  if (x < 1) return null
  const i = Math.floor((x - 1) / 2)
  return i < count ? i : null
}

export default function Filmstrip(props: FilmstripProps, surface: ClientSurface<StripState>) {
  const { Box, Text } = surface.elements
  const hover = surface.state?.hover ?? null

  surface.onPointer(e => {
    const i = clipAt(e.x, props.clips.length)
    const clip = i === null ? undefined : props.clips[i]
    if (e.type === 'down' && e.button === 'left' && clip !== undefined) {
      surface.post({ pick: clip.n })
      return
    }
    const next = e.type === 'leave' ? null : (clip?.n ?? null)
    if ((e.type === 'move' || e.type === 'enter' || e.type === 'leave') && next !== hover) surface.setState({ hover: next })
  })

  const top: { fg: string; bg: string }[] = []
  const bottom: { fg: string; bg: string }[] = []
  for (let x = 0; x < props.width; x++) {
    const i = clipAt(x, props.clips.length)
    const onClip = i !== null && (x - 1) % 2 === 0
    const clip = i === null ? undefined : props.clips[i]
    const marked = onClip && clip !== undefined && (clip.n === hover || clip.n === props.selected)
    const film = marked ? props.mark : x % 3 === 1 ? props.hole : props.film
    const isPlayhead = clip !== undefined && clip.n === props.current && !onClip
    const middle = isPlayhead ? props.playhead : onClip && clip !== undefined ? clip.color : props.gap
    top.push({ fg: isPlayhead ? props.playhead : film, bg: middle })
    bottom.push({ fg: middle, bg: isPlayhead ? props.playhead : film })
  }

  const row = (cells: { fg: string; bg: string }[]) => (
    <Box flexDirection="row">
      {cells.map(cell => (
        <Text color={cell.fg} backgroundColor={cell.bg}>
          ▀
        </Text>
      ))}
    </Box>
  )
  return (
    <Box flexDirection="column">
      {row(top)}
      {row(bottom)}
    </Box>
  )
}
