import type { Elements } from 'claude-code'

import type { Elements as AllElements } from 'claude-code'

import type { Activity, Dialog, Keyframe, Tab } from '../../types'
import type { RasterFrame } from '../animator'
import type { LayoutV2 } from '../layout'
import type { Theme } from '../themes'
import { chromeCells } from './chrome'
import { dialogView } from './dialogs'
import { mascotAmpView } from './mascotAmp'
import type { AmpActions, AmpVM } from './mascotAmp'

type Els = Elements['terminal']

type Tree = ReturnType<AllElements['terminal']['Box']>

export type StudioVM = {
  cols: number
  layout: LayoutV2
  theme: Theme
  tab: Tab
  keyframes: readonly Keyframe[]
  current: number
  selected: Keyframe | null
  activity: Activity
  elapsed: string
  visitors: number | null
  frames: Readonly<Partial<Record<string, RasterFrame>>>
  amp?: AmpVM
  dialog: Dialog
  screensaver: boolean
}

/** The clickable rows, built by the hooks module (Client rows, or plain Text after a fault). */
export type StudioParts = { title: Tree; tabs: Tree; status: Tree; timeline: Tree | null; usage: Tree | null }

export type StudioActions = AmpActions & {
  dismissDialog(): void
}


function rasterOf(els: Els, frame: RasterFrame | undefined) {
  const { Raster } = els
  return frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
}

function tabContent(els: Els, vm: StudioVM, act: StudioActions, parts: StudioParts) {
  const { Box, Text } = els
  if (vm.tab === 'usage') return parts.usage
  if (vm.tab === 'music') {
    if (vm.amp === undefined) return <Text color={vm.theme.ink}>Music is off. Turn it on in /config.</Text>
    return mascotAmpView(els, vm.amp, vm.frames, act)
  }
  return parts.timeline
}

/** The whole pane: title chrome, tabs, the Stage, the active tab and the status bar. */
export function studioView(els: Els, vm: StudioVM, act: StudioActions, parts: StudioParts) {
  const { Box, Text, Raster } = els
  const { cols, layout, theme } = vm
  if (layout.tooNarrow) {
    return (
      <Box backgroundColor={theme.body}>
        <Text color={theme.ink}>Widen the pane to see the studio.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width={cols} backgroundColor={theme.body}>
      <Raster key="chrome" columns={cols} rows={1} cells={chromeCells(theme, cols)} />
      {parts.title}
      {parts.tabs}
      <Box key="stage-section" flexDirection="row" backgroundColor={theme.body}>
        <Text color={theme.body} backgroundColor={theme.body}>
          {' '}
        </Text>
        {rasterOf(els, vm.frames.stage)}
        {dialogView(els, vm.dialog, cols, () => act.dismissDialog())}
      </Box>
      <Box key="tab-content" flexDirection="column" height={layout.content} backgroundColor={theme.body}>
        {tabContent(els, vm, act, parts)}
      </Box>
      {parts.status}
    </Box>
  )
}
