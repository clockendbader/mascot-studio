import type { Dialog } from '../types'

export const WAITING = 'Clawd is waiting on you'
export const QUESTION_TEXT = 'MascotProgramming: hey! i have a question for you'
const ASKING = 'MascotProgramming: hey! i need ur OK'

/** The instant message for a permission prompt on a tool and its target. */
export function needsYouText(tool: string, target: string): string {
  return target === '' ? `${ASKING} to run ${tool}` : `${ASKING} to run ${tool}: ${target}`
}

/** The instant message for a permission notification, which names no tool. */
export function notifiedText(message: string): string {
  return message === '' ? ASKING : `${ASKING} — ${message}`
}

/** The plugin's one status line: waiting on the person, else the usage warning, else nothing. */
export function statusLine(dialog: Dialog, warning: string | undefined): string | undefined {
  if (dialog?.kind === 'needs-you') return WAITING
  return warning
}
