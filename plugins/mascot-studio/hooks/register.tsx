import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Dialog, Keyframe, Opener, Scene, UsageSnapshot } from '../types'
import { finishKeyframe, firstLine, poseForTool, startKeyframe, targetOf } from './activity'
import { rasterFrames } from './animator'
import type { AnimModel, RasterKey } from './animator'
import { formatElapsed, hatFor } from './calendar'
import { statusLine } from './alerts'
import { layoutFor } from './layout'
import { costLabel, highestPercent, limitsView, pushHistory, snapshotFrom, usageWarning } from './usage'
import type { RawUsage } from './usage'
import { taskManagerSizes } from './views/taskManager'
import { studioView } from './views/studio'

const PANE = 'mascot-studio'
const HOP_MS = 1500
const TICK_MS = 166

const opener = atom({ plugin: 'mascot-studio', key: 'opener' } as const, null as Opener)
const activity = atom({ plugin: 'mascot-studio', key: 'activity' } as const, { pose: 'asleep', since: 0 } as Activity)
const keyframes = atom({ plugin: 'mascot-studio', key: 'keyframes' } as const, [] as Keyframe[])
const selectedFrame = atom({ plugin: 'mascot-studio', key: 'selectedFrame' } as const, null as number | null)
const scene = atom({ plugin: 'mascot-studio', key: 'scene' } as const, 1 as Scene)
const turnStartedAt = atom({ plugin: 'mascot-studio', key: 'turnStartedAt' } as const, null as number | null)
const idleSince = atom({ plugin: 'mascot-studio', key: 'idleSince' } as const, null as number | null)
const turns = atom({ plugin: 'mascot-studio', key: 'turns' } as const, 0)
const usage = atom({ plugin: 'mascot-studio', key: 'usage' } as const, { rateLimits: [], toolCalls: 0 } as UsageSnapshot)
const contextHistory = atom({ plugin: 'mascot-studio', key: 'contextHistory' } as const, [] as number[])
const dialog = atom({ plugin: 'mascot-studio', key: 'dialog' } as const, null as Dialog)

/** The cwd's last path segment, for the pane title. */
let folder = 'untitled'
/** Animation tick and the clock as of the last tick; both start over on a reload. */
let tick = 0
let now = 0
/** What the pane last drew: the ticker repaints these rasters until a repaint is refused. */
let drawn: { model: AnimModel; mounted: Set<RasterKey> } | null = null
/** Set while a startup pane that landed inline is being closed, so it closes and hints once. */
let isClosingStartup = false

const TERMINAL_ONLY = 'Mascot Studio runs in the terminal for now.'
const STARTUP_HINT = 'Mascot Studio: type /studio to open it.'
const paneTitle = () => `Mascot Studio MX · ${folder}.fla`
const HISTORY_MAX = 120
/** The status line as last set, so it is only set again when it changes. */
let lastStatus: string | undefined

/** Sets the plugin's status line from the dialog and the usage warning, when the text changed. */
async function refreshStatus($: EngineInterface): Promise<void> {
  const text = statusLine(await read($, dialog), usageWarning(await read($, usage), new Date(await $.clock.now())))
  if (text === lastStatus) return
  lastStatus = text
  $.ui.status(text)
}

/** Takes the engine's usage figures, if they look like figures. */
function isRawUsage(value: unknown): value is RawUsage {
  const v = value as { context?: unknown; rateLimits?: unknown } | null
  return typeof v === 'object' && v !== null && typeof v.context === 'object' && Array.isArray(v.rateLimits)
}

function folderOf(cwd: string): string {
  const parts = cwd.split(/[\\/]/).filter(part => part !== '')
  return parts.at(-1) ?? 'untitled'
}

/** What a tool call's result says about failure: an error result or a refusal. */
function failureOf(result: unknown): string | undefined {
  const r = (result ?? {}) as { isError?: boolean; text?: unknown; deny?: unknown }
  if (typeof r.deny === 'string') return firstLine(r.deny)
  if (r.isError === true) return firstLine(typeof r.text === 'string' ? r.text : '')
  return undefined
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    folder = folderOf(e.cwd)
    await $.command.register({ name: 'studio', description: 'Open or close Mascot Studio' })
    const animate = async () => {
      tick += 1
      now = await $.clock.now()
      const last = drawn
      if (last === null || last.mounted.size === 0) return
      for (const frame of rasterFrames(last.model, tick, now)) {
        if (!last.mounted.has(frame.key)) continue
        const painted = await $.ui.blit({ requestId: PANE, key: frame.key, cells: frame.cells })
        if (painted.deny !== undefined) last.mounted.delete(frame.key)
      }
    }
    $.clock.every(TICK_MS, () => {
      void animate().catch(() => undefined)
    })
    try {
      const figures: unknown = await $.session.usage()
      if (isRawUsage(figures)) {
        const calls = (await read($, keyframes)).at(-1)?.n ?? 0
        await update($, usage, () => snapshotFrom(figures, calls))
        await refreshStatus($)
      }
    } catch {
      // no figures yet; session.measure brings them
    }
    const hasTerminal = (await $.session.surfaces()).includes('terminal')
    if (options.openOnStartup !== false && hasTerminal) {
      await update($, opener, () => 'startup' as Opener)
      void $.ui.open({ id: PANE, title: paneTitle() })
    }
    return next(e)
  })

  on('command.run', { command: 'studio' }, async $ => {
    if (!(await $.session.surfaces()).includes('terminal')) return { text: TERMINAL_ONLY }
    const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (isOpen) {
      await $.ui.close({ id: PANE })
      return { text: 'Mascot Studio closed.' }
    }
    await update($, opener, () => 'person' as Opener)
    await $.ui.open({ id: PANE, title: paneTitle() })
    return { text: 'Mascot Studio opened.' }
  })

  on('tool.call', async ($, e, next) => {
    let id = ''
    let started = 0
    try {
      started = await $.clock.now()
      const tool = String(e.tool)
      const target = targetOf(e as unknown as Record<string, unknown>)
      const pose = poseForTool(tool)
      await update($, keyframes, list => {
        id = e.tool_use_id ?? `k${(list.at(-1)?.n ?? 0) + 1}`
        return startKeyframe(list, { id, tool, target, pose, startedAt: started })
      })
      await update($, activity, () => ({ pose, tool, target, since: started }))
      await update($, idleSince, () => null)
    } catch {
      // the studio never stands in the way of a tool call
    }
    const result = await next(e)
    try {
      const ended = await $.clock.now()
      const errorLine = failureOf(result)
      await update($, keyframes, list =>
        finishKeyframe(list, id, {
          durationMs: ended - started,
          isError: errorLine !== undefined,
          ...(errorLine !== undefined ? { errorLine } : {}),
        }),
      )
      const isTurnRunning = (await read($, turnStartedAt)) !== null
      const isAllDone = (await read($, keyframes)).every(frame => frame.durationMs !== undefined)
      if (isTurnRunning && isAllDone) await update($, activity, last => ({ ...last, pose: 'thinking', since: ended }) as Activity)
    } catch {
      // observing only
    }
    return result
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    try {
      const now = await $.clock.now()
      await update($, activity, () => ({ pose: 'thinking', since: now }) as Activity)
      await update($, scene, () => 1 as Scene)
      await update($, turnStartedAt, () => now)
      await update($, idleSince, () => null)
    } catch {
      // observing only
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    try {
      const now = await $.clock.now()
      await update($, activity, () => ({ pose: 'hop', since: now }) as Activity)
      await update($, turns, n => n + 1)
      await update($, turnStartedAt, () => null)
      const pct = (await read($, usage)).contextPercent
      await update($, contextHistory, list => pushHistory(list, pct, HISTORY_MAX))
      $.clock.after(HOP_MS, () => {
        void (async () => {
          if ((await read($, turnStartedAt)) !== null) return
          const at = await $.clock.now()
          await update($, scene, () => 2 as Scene)
          await update($, activity, () => ({ pose: 'asleep', since: at }) as Activity)
          await update($, idleSince, () => at)
        })()
      })
    } catch {
      // observing only
    }
    return result
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    try {
      const calls = (await read($, keyframes)).at(-1)?.n ?? 0
      await update($, usage, () => snapshotFrom(e, calls))
      await refreshStatus($)
    } catch {
      // observing only
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text>{TERMINAL_ONLY}</Text>
    }
    const els = $.ui.resolve(e)
    if (e.props.placement === 'inline' && (await read($, opener)) === 'startup') {
      if (!isClosingStartup) {
        isClosingStartup = true
        $.clock.after(0, () => {
          void (async () => {
            await $.ui.close({ id: PANE })
            $.ui.toast(STARTUP_HINT)
            await update($, opener, () => null as Opener)
            isClosingStartup = false
          })()
        })
      }
      drawn = null
      return <els.Box />
    }
    const cols = e.props.bodyColumns
    const rows = e.props.scroll.bodyRows
    const at = await $.clock.now()
    const act = await read($, activity)
    const frames = await read($, keyframes)
    const selected = await read($, selectedFrame)
    const sc = await read($, scene)
    const startedAt = await read($, turnStartedAt)
    const figures = await read($, usage)
    const history = await read($, contextHistory)
    const quietSince = await read($, idleSince)
    const turnCount = await read($, turns)
    const layout = layoutFor(cols, rows, sc, false)
    const current = frames.at(-1)?.n ?? 0

    const model: AnimModel = {}
    if (!layout.tooNarrow && sc === 1) model.stage = { cols, pose: act.pose, hat: hatFor(new Date(at)), screensaver: null }
    if (!layout.tooNarrow && sc === 2) {
      model.tm = {
        ...taskManagerSizes(cols),
        samples: history,
        ...(figures.contextPercent !== undefined ? { pct: figures.contextPercent } : {}),
        ...(highestPercent(figures) !== undefined ? { highest: highestPercent(figures) } : {}),
        idleSince: quietSince,
        title: 'Task Manager',
      }
    }
    const rasters = rasterFrames(model, tick, at)
    drawn = { model, mounted: new Set(rasters.map(frame => frame.key)) }

    return studioView(
      els,
      {
        cols,
        layout,
        scene: sc,
        keyframes: frames,
        soundFrames: [],
        current,
        selected: selected === null ? null : (frames.find(frame => frame.n === selected) ?? null),
        activity: act,
        elapsed: startedAt === null ? '' : formatElapsed(at - startedAt),
        visitors: null,
        frames: Object.fromEntries(rasters.map(frame => [frame.key, frame])),
        ...(sc === 2
          ? {
              tm: {
                cols,
                boxes: layout.tmBoxes,
                ...(figures.contextPercent !== undefined ? { pct: figures.contextPercent } : {}),
                limits: limitsView(figures, new Date(at)),
                costLabel: costLabel(figures),
                ...(figures.costUsd !== undefined ? { costUsd: figures.costUsd } : {}),
                turns: turnCount,
                toolCalls: current,
              },
            }
          : {}),
      },
      {
        selectFrame: n => void update($, selectedFrame, () => n),
        live: () => void update($, selectedFrame, () => null),
        toggleScene: () => void update($, scene, s => (s === 1 ? 2 : 1) as Scene),
      },
    )
  })
}
