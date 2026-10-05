import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Opener } from '../types'

const PANE = 'mascot-studio'

const opener = atom({ plugin: 'mascot-studio', key: 'opener' } as const, null as Opener)

/** The cwd's last path segment, for the pane title. */
let folder = 'untitled'

function folderOf(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(part => part !== '')
  return parts.at(-1) ?? 'untitled'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    folder = folderOf(e.cwd)
    await $.command.register({ name: 'studio', description: 'Open or close Mascot Studio' })
    return next(e)
  })

  on('command.run', { command: 'studio' }, async $ => {
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Mascot Studio closed.' }
    }
    await update($, opener, () => 'person' as Opener)
    await $.ui.open({ id: PANE, title: `Mascot Studio MX · ${folder}.fla` })
    return { text: 'Mascot Studio opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>Mascot Studio</Text>
  })
}
