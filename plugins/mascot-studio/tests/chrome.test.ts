import { test, expect, describe } from 'claude-code/testing'
import { THEMES } from '../hooks/themes'
import { answerEngine, mountPane, startSession, PANE } from './harness'

type Mounted = Awaited<ReturnType<typeof mountPane>>
type Node = { type?: string; props?: Record<string, unknown>; children?: unknown[] }

/** The Text runs a Client row drew, in order, with the column each starts at. */
async function runs(ui: Mounted, key: string): Promise<{ text: string; x: number; props: Record<string, unknown> }[]> {
  const tree = (await ui.drawn({ in: key })) as unknown as Node
  const out: { text: string; x: number; props: Record<string, unknown> }[] = []
  let x = 0
  const walk = (n: unknown) => {
    if (typeof n !== 'object' || n === null) return
    const node = n as Node
    if (node.type === 'Text') {
      const text = (node.children ?? []).filter(c => typeof c === 'string').join('')
      out.push({ text, x, props: node.props ?? {} })
      x += [...text].length
      return
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(tree)
  return out
}

async function xOf(ui: Mounted, key: string, label: string): Promise<number> {
  const run = (await runs(ui, key)).find(r => r.text.includes(label))
  if (run === undefined) throw new Error(`${label} not in ${key}`)
  return run.x + run.text.indexOf(label)
}

async function bgOf(ui: Mounted, key: string, label: string): Promise<unknown> {
  return (await runs(ui, key)).find(r => r.text.includes(label))?.props.backgroundColor
}

const win7 = THEMES.windows7

describe('tabs', () => {
  test('start on Timeline', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    expect(await bgOf(ui, 'tabs', 'Timeline')).toBe(win7.tabs.active)
    expect(await bgOf(ui, 'tabs', 'Usage')).toBe(win7.tabs.idle)
  })

  test('a click switches tab', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    await ui.pointer({ type: 'down', x: await xOf(ui, 'tabs', 'Usage'), y: 0, button: 'left', in: 'tabs' })
    await ui.pointer({ type: 'up', x: await xOf(ui, 'tabs', 'Usage'), y: 0, button: 'left', in: 'tabs' })
    expect(await bgOf(ui, 'tabs', 'Usage')).toBe(win7.tabs.active)
    expect(await bgOf(ui, 'tabs', 'Timeline')).toBe(win7.tabs.idle)
  })

  test('hovering a tab lights it up', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    await ui.pointer({ type: 'move', x: await xOf(ui, 'tabs', 'Music'), y: 0, in: 'tabs' })
    expect(await bgOf(ui, 'tabs', 'Music')).toBe(win7.tabs.hover)
  })

  test('a focused tab row takes 1, 2 and 3', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    const usage = await xOf(ui, 'tabs', 'Usage')
    await ui.pointer({ type: 'down', x: usage, y: 0, button: 'left', in: 'tabs' })
    await ui.pointer({ type: 'up', x: usage, y: 0, button: 'left', in: 'tabs' })
    await ui.key({ key: '3', in: 'tabs' })
    expect(await bgOf(ui, 'tabs', 'Music')).toBe(win7.tabs.active)
  })

  test('/studio usage and /studio music switch tabs', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    expect(await $.command.run({ command: 'studio', args: 'usage' } as never)).toMatchObject({ text: expect.stringContaining('Usage') })
    const ui = await mountPane($, 46, 24)
    expect(await bgOf(ui, 'tabs', 'Usage')).toBe(win7.tabs.active)
  })
})

describe('status bar', () => {
  test('clicking Context opens Usage', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    const x = await xOf(ui, 'status', 'Context')
    await ui.pointer({ type: 'down', x, y: 0, button: 'left', in: 'status' })
    expect(await bgOf(ui, 'tabs', 'Usage')).toBe(win7.tabs.active)
  })
})

describe('title chrome', () => {
  test('shows Clawd Studio in each theme', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    expect((await runs(ui, 'title')).map(r => r.text).join('')).toContain('Clawd Studio')
    expect(await ui.find({ key: 'chrome' })).toBeDefined()
  })

  test('the Mac title is centred', async ($, on) => {
    answerEngine(on, { os: 'macos' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    const x = await xOf(ui, 'title', 'Clawd Studio')
    expect(Math.abs(x - (46 - 12) / 2)).toBeLessThanOrEqual(1)
  })

  test('the close button closes the pane', async ($, on) => {
    const { rec } = answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    await ui.pointer({ type: 'down', x: await xOf(ui, 'title', '✕'), y: 0, button: 'left', in: 'title' })
    expect(rec.closed).toContain(PANE)
  })

  test('/studio theme macos switches the look for this session', async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    expect(await $.command.run({ command: 'studio', args: 'theme macos' } as never)).toMatchObject({ text: 'Theme set to Mac OS X (this session).' })
    const ui = await mountPane($, 46, 24)
    expect(await bgOf(ui, 'tabs', 'Timeline')).toBe(THEMES.macos.tabs.active)
  })

  test('the theme setting picks the look', { options: { theme: 'ubuntu' } }, async ($, on) => {
    answerEngine(on, { os: 'windows' })
    await startSession($)
    const ui = await mountPane($, 46, 24)
    expect(await bgOf(ui, 'tabs', 'Timeline')).toBe(THEMES.ubuntu.tabs.active)
  })
})

describe('legible on any terminal', () => {
  for (const theme of ['windows7', 'macos', 'ubuntu'] as const) {
    for (const [cols, rows] of [[32, 20], [46, 24], [60, 30]] as const) {
      test(`${theme} at ${cols} by ${rows}: every chrome text sets its colour`, { options: { theme } }, async ($, on) => {
        answerEngine(on, { os: 'windows' })
        await startSession($)
        const ui = await mountPane($, cols, rows)
        for (const key of ['title', 'tabs', 'status']) for (const run of await runs(ui, key)) expect(run.props.color).toBeDefined()
      })
    }
  }
})

