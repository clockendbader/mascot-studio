import type { Dialog } from '../types'

export const WAITING = 'ᓚᘏᗢ Mascot is waiting on you'

/** The plugin's one status line: waiting on the person, else the usage warning, else nothing. */
export function statusLine(dialog: Dialog, warning: string | undefined): string | undefined {
  if (dialog?.kind === 'needs-you') return WAITING
  return warning
}
