import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Dialog, Keyframe, Opener, Scene, SoundAction, SoundStatus, UsageSnapshot } from '../types'
import { finishKeyframe, firstLine, poseForTool, startKeyframe, targetOf } from './activity'
import { nextHeights } from './art/instruments'
import { TICK_MS, rasterFrames } from './animator'
import type { AnimModel, RasterKey } from './animator'
import { formatElapsed, hatFor } from './calendar'
import { QUESTION_TEXT, needsYouText, notifiedText, statusLine } from './alerts'
import { layoutFor } from './layout'
import { costLabel, highestPercent, limitsView, pushHistory, snapshotFrom, usageWarning } from './usage'
import type { RawUsage } from './usage'
import { taskManagerSizes } from './views/taskManager'
import { marqueeOf } from './views/mascotAmp'
import { linuxBackend } from './sound/linux'
import { macosBackend } from './sound/macos'
import { detectOs } from './sound/platform'
import type { Os } from './sound/platform'
import type { Piece, SoundBackend, SoundHost } from './sound/types'
import { windowsBackend } from './sound/windows'
import { studioView } from './views/studio'

const PANE = 'mascot-studio'
const HOP_MS = 1500
const ERROR_DIALOG_MS = 8000

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
const sound = atom({ plugin: 'mascot-studio', key: 'sound' } as const, { kind: 'nothing' } as SoundStatus)
const soundFrames = atom({ plugin: 'mascot-studio', key: 'soundFrames' } as const, [] as number[])
const screensaver = atom({ plugin: 'mascot-studio', key: 'screensaver' } as const, false)
const visitors = atom({ plugin: 'mascot-studio', key: 'visitors' } as const, null as number | null)

/** The cwd's last path segment, for the pane title. */
let folder = 'untitled'
/** Animation tick and the clock as of the last tick; both start over on a reload. */
let tick = 0
let now = 0
/** What the pane last drew: the ticker repaints these rasters until a repaint is refused. */
let drawn: { model: AnimModel; mounted: Set<RasterKey> } | null = null
/** Set while a startup pane that landed inline is being closed, so it closes and hints once. */
let isClosingStartup = false
/** Set while a tick's repaints are in flight. */
let isAnimating = false

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

const MAX_SOUND_FRAMES = 200
/** The sound backend for this OS and the host it runs on; the watch's stop function. */
let soundBackend: SoundBackend | null = null
let soundHost: SoundHost | null = null
let stopSound: (() => void) | null = null
/** The OS this session runs on, detected at start; picks the auto theme and the sound backend. */
let osName: Os = 'other'
/** The decorative spectrum's bars, walked each tick. */
let vizHeights: number[] = []

const trackOf = (s: SoundStatus) => (s.kind === 'playing' || s.kind === 'paused' ? s.track : undefined)

/** Records a sound status: unchanged ones cost nothing; a new track adds a Sound-layer keyframe. */
async function applySound($: EngineInterface, next: SoundStatus): Promise<void> {
  const previous = await read($, sound)
  if (JSON.stringify(previous) === JSON.stringify(next)) return
  const before = trackOf(previous)
  const after = trackOf(next)
  if (after !== undefined && (before === undefined || before.title !== after.title || before.artist !== after.artist)) {
    const n = (await read($, keyframes)).at(-1)?.n ?? 0
    await update($, soundFrames, list => [...list, n].slice(-MAX_SOUND_FRAMES))
  }
  await update($, sound, () => next)
}

/** (Re)starts watching the system's now-playing with this OS's backend. */
function watchSound($: EngineInterface): void {
  stopSound?.()
  stopSound = null
  const onStatus = (s: SoundStatus) => {
    void applySound($, s).catch(() => undefined)
  }
  if (soundBackend === null || soundHost === null) {
    onStatus({ kind: 'unavailable', reason: 'unsupported-os' })
    return
  }
  stopSound = soundBackend.watch(soundHost, onStatus)
}

/** Shows a dialog (or clears it with null) and sets the status line to match. */
async function setDialog($: EngineInterface, next: Dialog): Promise<void> {
  await update($, dialog, () => next)
  await refreshStatus($)
}

/** Clears the dialog if it is of this kind. */
async function clearDialog($: EngineInterface, kind: 'error' | 'needs-you'): Promise<void> {
  if ((await read($, dialog))?.kind === kind) await setDialog($, null)
}

/** The mascot waves beside an instant message. */
async function needsYou($: EngineInterface, text: string): Promise<void> {
  const at = await $.clock.now()
  await setDialog($, { kind: 'needs-you', text, at })
  await update($, activity, last => ({ ...last, pose: 'wave', since: at }) as Activity)
}

/** Counts one more visitor (tool call) and saves the lifetime total; a failed save catches up next time. */
async function countVisitor($: EngineInterface): Promise<void> {
  await update($, visitors, n => (n ?? 0) + 1)
  try {
    await $.store.set('visitors', (await read($, visitors)) ?? 0)
  } catch {
    // saved with the next call
  }
}

/** Any activity wakes the screensaver. */
async function wake($: EngineInterface): Promise<void> {
  if (await read($, screensaver)) await update($, screensaver, () => false)
}

const SCREENSAVER_CHECK_TICKS = 6

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
  const screensaverMs = Math.max(0, Number(options.screensaverMinutes ?? 5)) * 60_000

  on('session.start', async ($, e, next) => {
    folder = folderOf(e.cwd)
    await $.command.register({ name: 'studio', description: 'Open or close Mascot Studio' })
    if ((await read($, visitors)) === null) {
      const stored = await $.store.get('visitors').catch(() => 0)
      const total = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0
      await update($, visitors, n => n ?? total)
    }
    const animate = async () => {
      tick += 1
      now = await $.clock.now()
      if (screensaverMs > 0 && tick % SCREENSAVER_CHECK_TICKS === 0) {
        const quiet = await read($, idleSince)
        if (quiet !== null && now - quiet >= screensaverMs && !(await read($, screensaver))) await update($, screensaver, () => true)
      }
      const last = drawn
      if (last === null || last.mounted.size === 0) return
      if (last.model.amp !== undefined) {
        vizHeights = nextHeights(vizHeights, last.model.amp.mode === 'dance', Math.random)
        last.model.amp.heights = vizHeights
      }
      for (const frame of rasterFrames(last.model, tick, now)) {
        if (!last.mounted.has(frame.key)) continue
        const painted = await $.ui.blit({ requestId: PANE, key: frame.key, cells: frame.cells })
        if (painted.deny !== undefined) last.mounted.delete(frame.key)
      }
    }
    $.clock.every(TICK_MS, () => {
      // a surface still taking the last frame skips this tick rather than stacking repaints
      if (isAnimating) return
      isAnimating = true
      void animate()
        .catch(() => undefined)
        .finally(() => {
          isAnimating = false
        })
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
    osName = await detectOs(await $.env.get('OS'), async () => (await $.process.run(['uname', '-s'])).stdout).catch(() => 'other' as Os)
    if (options.sound !== false) {
      now = await $.clock.now()
      soundHost = {
        run: (argv, timeoutMs) => $.process.run([...argv], timeoutMs === undefined ? undefined : { timeoutMs }),
        spawn: argv => $.process.spawn({ argv: [...argv] }) as unknown as AsyncIterable<Piece>,
        every: (ms, fn) => $.clock.every(ms, fn),
        after: (ms, fn) => $.clock.after(ms, fn),
        now: () => now,
      }
      soundBackend = osName === 'windows' ? windowsBackend : osName === 'macos' ? macosBackend : osName === 'linux' ? linuxBackend : null
      watchSound($)
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
      await wake($)
      await countVisitor($)
      await clearDialog($, 'error')
      if (tool === 'AskUserQuestion') await setDialog($, { kind: 'needs-you', text: QUESTION_TEXT, at: started })
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
      await clearDialog($, 'needs-you')
      const isTurnRunning = (await read($, turnStartedAt)) !== null
      const isAllDone = (await read($, keyframes)).every(frame => frame.durationMs !== undefined)
      if (errorLine !== undefined) {
        const tool = String(e.tool)
        await update($, activity, last => ({ ...last, pose: 'facepalm', since: ended }) as Activity)
        await setDialog($, { kind: 'error', tool, line: errorLine, at: ended })
        $.clock.after(ERROR_DIALOG_MS, () => {
          void (async () => {
            const shown = await read($, dialog)
            if (shown?.kind === 'error' && shown.at === ended) await setDialog($, null)
          })()
        })
      } else if (isTurnRunning && isAllDone) {
        await update($, activity, last => ({ ...last, pose: 'thinking', since: ended }) as Activity)
      }
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
      await wake($)
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
      await clearDialog($, 'needs-you')
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

  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      const target = targetOf((e.tool_input ?? {}) as Record<string, unknown>)
      await needsYou($, needsYouText(e.tool_name, target))
    } catch {
      // observing only: the person decides, never the studio
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('classic.Notification', async ($, e, next) => {
    try {
      if (e.notification_type === 'permission_prompt' && (await read($, dialog))?.kind !== 'needs-you') {
        await needsYou($, notifiedText(e.message))
      }
    } catch {
      // observing only
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('prompt.submit', async ($, e, next) => {
    try {
      await clearDialog($, 'needs-you')
      await wake($)
    } catch {
      // observing only
    }
    return next(e)
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
    const shownDialog = await read($, dialog)
    const isSaving = (await read($, screensaver)) && screensaverMs > 0
    const visitorCount = await read($, visitors)
    const soundStatus = await read($, sound)
    const soundKeys = await read($, soundFrames)
    const hasSound = options.sound !== false
    const layout = layoutFor(cols, rows, sc, hasSound)
    const current = frames.at(-1)?.n ?? 0

    const model: AnimModel = {}
    if (!layout.tooNarrow && (sc === 1 || isSaving)) {
      model.stage = {
        cols,
        pose: act.pose,
        hat: hatFor(new Date(at)),
        screensaver: isSaving ? { since: (quietSince ?? at) + screensaverMs } : null,
      }
    }
    if (!layout.tooNarrow && layout.amp === 'full') {
      model.amp = {
        lcdCols: cols - 14,
        marquee: marqueeOf(soundStatus),
        mode: soundStatus.kind === 'playing' ? 'dance' : soundStatus.kind === 'paused' ? 'sway' : 'doze',
        heights: vizHeights,
      }
    }
    if (!layout.tooNarrow && sc === 2 && !isSaving) {
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
        soundFrames: soundKeys,
        dialog: shownDialog,
        screensaver: isSaving,
        current,
        selected: selected === null ? null : (frames.find(frame => frame.n === selected) ?? null),
        activity: act,
        elapsed: startedAt === null ? '' : formatElapsed(at - startedAt),
        visitors: visitorCount,
        frames: Object.fromEntries(rasters.map(frame => [frame.key, frame])),
        ...(hasSound ? { amp: { cols, mode: layout.amp === 'line' ? ('line' as const) : ('full' as const), status: soundStatus } } : {}),
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
        dismissDialog: () => void setDialog($, null),
        toggleScene: () => void update($, scene, s => (s === 1 ? 2 : 1) as Scene),
        sound: (action: SoundAction) => {
          void (async () => {
            const track = trackOf(await read($, sound))
            const isDone = soundBackend !== null && soundHost !== null && (await soundBackend.control(soundHost, action, track))
            if (!isDone) $.ui.toast(`MascotAmp couldn't reach ${track?.app ?? 'the player'}`)
          })()
        },
        retrySound: () => {
          void update($, sound, () => ({ kind: 'nothing' }) as SoundStatus).then(() => watchSound($))
        },
      },
    )
  })
}
