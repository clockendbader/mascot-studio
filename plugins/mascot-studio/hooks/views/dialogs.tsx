import type { Elements } from 'claude-code'

import type { Dialog } from '../../types'

type Els = Elements['terminal']

const WINDOW = '#D4D0C8'
const TITLE_BAR = '#0A246A'
const WHITE = '#FFFFFF'
const INK = '#000000'
const MAX_WIDTH = 40

/** A period dialog over the Stage: the error box, or the instant-message window when the mascot needs you. */
export function dialogView(els: Els, dialog: Dialog, cols: number, onOk: () => void) {
  if (dialog === null) return null
  const { Box, Text, Button } = els
  const width = Math.max(20, Math.min(cols - 4, MAX_WIDTH))
  const titleBar = (title: string) => (
    <Text backgroundColor={TITLE_BAR} color={WHITE} wrap="truncate-end">
      {` ${title}`.padEnd(width - 2)}
    </Text>
  )

  if (dialog.kind === 'error') {
    return (
      <Box key="dialog" position="absolute" top={1} left={2} width={width} flexDirection="column" borderStyle="single" backgroundColor={WINDOW}>
        {titleBar('Mascot Programming')}
        <Text color={INK} backgroundColor={WINDOW} wrap="truncate-end">{` ✖ ${dialog.tool} failed: ${dialog.line}`}</Text>
        <Box flexDirection="row" justifyContent="center">
          <Button key="ok" label="OK" onPress={() => onOk()} />
        </Box>
      </Box>
    )
  }

  return (
    <Box key="dialog" position="absolute" top={1} left={2} width={width} flexDirection="column" borderStyle="single" backgroundColor={WINDOW}>
      {titleBar('Instant Message')}
      <Text color={INK} backgroundColor={WINDOW} wrap="wrap">
        {dialog.text}
      </Text>
    </Box>
  )
}
