import type { Elements } from 'claude-code'

import type { Tab } from '../../types'
import type { RasterFrame } from '../animator'
import type { LayoutV2 } from '../layout'
import type { Theme } from '../themes'
import { chromeCells } from './chrome'

type Els = Elements['terminal']

type Tree = ReturnType<Els['Box']>

export type StudioVM = {
  cols: number
  layout: LayoutV2
  theme: Theme
  tab: Tab
  frames: Readonly<Partial<Record<string, RasterFrame>>>
}

/** The pieces the hooks module builds: the clickable rows (Client rows, or plain Text after a fault), each tab's content and the dialog. */
export type StudioParts = { title: Tree; tabs: Tree; status: Tree; timeline: Tree | null; usage: Tree | null; music: Tree | null; dialog: Tree | null }


function rasterOf(els: Els, frame: RasterFrame | undefined) {
  const { Raster } = els
  return frame === undefined ? null : <Raster key={frame.key} columns={frame.columns} rows={frame.rows} cells={frame.cells} />
}

function tabContent(vm: StudioVM, parts: StudioParts) {
  if (vm.tab === 'usage') return parts.usage
  if (vm.tab === 'music') return parts.music
  return parts.timeline
}

/** The whole pane: title chrome, tabs, the Stage, the active tab and the status bar. */
export function studioView(els: Els, vm: StudioVM, parts: StudioParts) {
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
        {parts.dialog}
      </Box>
      <Box key="tab-content" flexDirection="column" height={layout.content} backgroundColor={theme.body}>
        {tabContent(vm, parts)}
      </Box>
      {parts.status}
    </Box>
  )
}
