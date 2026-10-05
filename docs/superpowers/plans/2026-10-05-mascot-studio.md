# Mascot Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Mascot Studio Claude Code mod: a terminal pane in a 2002 animation-studio style where a pixel-art cat acts out the agent's work, checks usage in a period Task Manager, and shares the pane with a music panel, published as an installable GitHub plugin marketplace.

**Architecture:** One plugin of function hooks. `hooks/register.tsx` is the only file that touches the engine (`$`). It turns engine events into `$.state` writes, draws the Pane, runs one ~6 fps ticker that repaints `Raster`s with `$.ui.blit`, and builds host callbacks for the sound backends. Every other file is pure (data in, data or tree out) and unit-tested without the engine. Views are pure functions of the terminal element table, a view model and action callbacks.

**Tech Stack:** TypeScript/TSX hooks module for Claude Code 2.1.289 function hooks (`claude-code`, `claude-code/testing`), `claude plugin validate` / `claude plugin test`, PowerShell 5.1 + WinRT (Windows), `playerctl` (Linux), `pgrep` + `osascript` (macOS), git + `gh`.

**Spec:** `docs/superpowers/specs/2026-10-05-mascot-studio-design.md`

## Global Constraints

- Plugin folder: `plugins/mascot-studio/`; plugin name `mascot-studio`; Pane id `mascot-studio`; command `studio`.
- **`$` rule (verified by `claude plugin validate`):** `$` may only be used in `hooks/register.tsx`, spelled `$.noun.event(...)` at the call site. It is never passed to an imported function. Pure modules receive plain data or callbacks built in `register.tsx`.
- Atoms (`atom({ plugin: 'mascot-studio', key: '...' } as const, initial)`) are declared in `register.tsx`, and every key is declared in `types/index.d.ts` under `interface PluginState { 'mascot-studio': {...} }`. A render hook never writes state.
- The contract file exports only types (`export type ...`) plus the `declare module 'claude-code'` block (validated: `export {}` is refused).
- Surface: terminal only. The terminal element table is `Elements['terminal']`. `Text` carries no `key`, so tests find Text by `text`, and Box/Button/Raster by `key`.
- Settings (`userConfig`): `openOnStartup` boolean default `true`; `sound` boolean default `true`; `screensaverMinutes` number default `5` (0 disables).
- Timing: ticker every **166 ms**; hop **1500 ms**; error dialog auto-close **8 s**; asleep after **60 s** quiet; screensaver rotation **60 s**; Windows poll **1000 ms**; macOS poll **2000 ms**.
- Sizes: mascot **24×24 px**; mini mascot **8×8 px**; DJ blob **10×10 px**; Stage **12 rows**; min body width **32 cols**; playhead **8 frames from the right edge**; keyframes kept **200**; timeline label column **10 cols**.
- Thresholds: under 80 green, **≥80 amber, ≥95 red**.
- Colors: Task Manager title gradient `#0A246A → #A6CAF0`; window grey `#D4D0C8`; LED/graph green `#00FF00`, dim green `#004000`, grid `#008040`, amber `#FFB000`, red `#FF3030`; Stage work area `#9A9A9A`, canvas `#FFFFFF`, canvas shadow `#666666`.
- Names: "Mascot Studio MX", "Task Manager", "MascotAmp", "Mascot Programming"/"MascotProgramming". Never Flash, Macromedia, Windows, Winamp or IE names or logos. All art is original.
- Raster cells: each code point must be printable, width-1 and in the BMP, or the whole tree is refused and the pane closes. Text bound for a Raster always goes through `sanitizeForRaster`.
- Observing hooks never change what they observe. They return `next(e)`'s result unchanged, catch their own errors, and every registration gets `.catch(($, e, next) => next(e))`.
- Commits use the person's GitHub noreply identity (Task 1). Nothing is pushed until Task 22's confirmation.

## Review Focus

1. **Track titles, artists or targets with emoji, CJK or control characters** reach a Raster (LCD, title bar). The person expects the pane to stay up with `?` in place of undrawable characters. Test in Task 2 (`sanitizeForRaster`) and Task 17 (LCD with `日本語 🎵`).
2. **The terminal is resized while animating.** Blits at the old size are denied. Expected: animation resumes at the new size after the redraw, without errors. Test in Task 8 (a deny drops the key; the next render re-adds it).
3. **Parallel tool calls finish out of order** (several Reads, subagents). Expected: each keyframe gets its own duration and ✓/✖. Test in Task 4 (`finishKeyframe` by id, out of order).
4. **Non-ASCII titles from PowerShell.** Expected: `Beyoncé` arrives intact. Test in Task 14 (the script sets UTF-8 output; the parser handles `\u00e9` escapes).
5. **`resetsAt` missing, malformed or in the past.** Expected: no "resets" text and no `NaN`. Test in Task 3 (`formatReset` returns `''`).

## Verified engine facts (from a probe plugin, Claude Code 2.1.289)

- **Test bodies get `($, on)`.** The test `$` exposes only the event nouns: `tool, command, config, telemetry, prompt, skill, attribution, agent, session, turn, ui, classic`. There is no `env/process/clock/store/state`.
- **The test's `on` hooks sit beneath the plugin and answer for the engine.**
  - Host noun calls answer `{ value: X }`: `command.register`, `ui.open`, `ui.close`, `ui.status`, `ui.toast`, `ui.blit`, `ui.panes`, `session.usage`, `session.surfaces`, `process.run`.
  - `process.spawn` answers with an `async function*` that yields `{ stream, text }` and `return { value: { code, signal } }`.
  - Lifecycle events answer their result directly: `session.start → { cwd: e.cwd }`, `tool.call → { result, text }` (plus `isError: true`), `turn.start → { turnId: e.turnId }`, `turn.complete → { text: e.answer }`.
  - The failure "returned neither { value } nor { deny }" means wrap the answer in `{ value }`.
- **Mocks:** `mock.clock(on, { now })` (with `advance(ms)`), `mock.env(on, vars)` and `mock.store(on, entries)` work through the plugin.
- **`$.ui.mount`** takes `{ plugin, surface: 'terminal', component: 'Pane', requestId, props: { title, isFocused, bodyColumns, placement: 'dock'|'inline', scroll: { offset, bodyRows } }, viewport? }`. A plain one-glyph `Button` press updates state and redraws.
- **Pane props:** `bodyColumns`, `placement`, `scroll.bodyRows`, `isFocused`.
- **APIs:** `$.clock.every(ms, fn)` and `$.clock.after(ms, fn)` return `{ cancel() }`; `$.clock.now()` is a Promise; `$.ui.blit({ requestId, key, cells })` resolves `{}` or `{ deny }`; `Uint8Array.prototype.toBase64()` exists.
- **Event fields:**
  - `tool.call` puts the tool's arguments at the top level of `e` (`e.file_path`, `e.command`), beside `tool`, `tool_use_id` and `agentId`.
  - `turn.complete` has `agentId` only for subagents, plus `durationMs` and `reason`.
  - `classic.PermissionRequest` has `tool_name` and `tool_input`; `classic.Notification` has `notification_type` and `message`.
- **Commands:** run tests with `claude plugin test plugins/mascot-studio` and validate with `claude plugin validate plugins/mascot-studio`, both from the repo root. TypeScript is not installed: type-check with `npx -y -p typescript@5 tsc -p plugins/mascot-studio` once the engine has laid `.claude-plugin/types/` (Task 1).

## File map

```
.gitignore  .gitattributes  LICENSE  README.md
.claude-plugin/marketplace.json
scripts/sync-dev.sh                        copy the plugin into a session's hot-reload mods folder
plugins/mascot-studio/
  .claude-plugin/plugin.json
  hooks/hooks.json
  hooks/register.tsx                       ALL engine calls: hooks, atoms, ticker, host callbacks, render
  hooks/activity.ts                        tool → pose, targets, keyframes, timeline window
  hooks/calendar.ts                        hats by date, reset/elapsed formatting
  hooks/usage.ts                           usage snapshot, levels, warnings, mini mood, history
  hooks/alerts.ts                          dialog texts, status-line priority
  hooks/layout.ts                          responsive layout decisions
  hooks/animator.ts                        which rasters exist and their cells for a tick
  hooks/art/pixels.ts                      grids, half-block packing, text cells, sanitizing
  hooks/art/sprites.ts                     palette + all sprite data + composition
  hooks/art/stage.ts                       Stage frame (work area, canvas, mascot)
  hooks/art/instruments.ts                 meters, graph, title bar, LCD, visualizer, DJ
  hooks/art/screensavers.ts                pipes, starfield, flying cats
  hooks/views/studio.tsx                   whole-pane view, menu, stage, properties
  hooks/views/timeline.tsx                 layers, keyframe buttons, footer
  hooks/views/taskManager.tsx              Scene 2
  hooks/views/mascotAmp.tsx                sound panel
  hooks/views/dialogs.tsx                  error dialog, instant-message window
  hooks/sound/types.ts                     SoundHost, SoundBackend
  hooks/sound/platform.ts                  OS detection, backend choice
  hooks/sound/supervisor.ts                line buffering, spawn watch with backoff
  hooks/sound/windows.ts  linux.ts  macos.ts
  types/index.d.ts                         state contract + shared types
  tests/harness.ts                         engine stand-ins shared by plugin tests
  tests/*.test.ts
```

Deviation from spec §10: there is no `hooks/state.ts`. The atoms live in `register.tsx`, because state references must be literal in the hooks module (see the `$` rule).

---

## Milestone 1 — Studio core

### Task 1: Repository scaffold and a loadable plugin

**Files:**
- Create: `.gitignore`, `.gitattributes`, `.claude-plugin/marketplace.json`, `scripts/sync-dev.sh`, `plugins/mascot-studio/.claude-plugin/plugin.json`, `plugins/mascot-studio/hooks/hooks.json`, `plugins/mascot-studio/hooks/register.tsx`, `plugins/mascot-studio/types/index.d.ts`, `plugins/mascot-studio/tests/harness.ts`
- Test: `plugins/mascot-studio/tests/command.test.ts`

**Interfaces:**
- Produces:
  - `tests/harness.ts`:
    - `answerEngine(on: On, opts?: BootOptions): { rec: Recorder; clock: MockClock }`
    - `startSession($: Engine): Promise<void>`, which calls `$.session.start({ cwd: '/work/my-project' })`.
    - `mountPane($: Engine, cols?: number, rows?: number, placement?: 'dock'|'inline')`, defaults 46, 30, `'dock'`.
    - `Recorder = { opened: string[]; closed: string[]; statuses: (string|undefined)[]; toasts: string[]; blits: { key: string; cells: string }[]; runs: string[][]; spawns: string[][] }`
    - `BootOptions = { os?: 'windows'|'macos'|'linux'; usage?: unknown; run?: (argv: string[]) => { exitCode: number; stdout: string; stderr: string }; spawn?: (argv: string[]) => AsyncIterable<{ stream: 'stdout'|'stderr'; text: string }>; store?: Record<string, unknown>; now?: number; surfaces?: string[]; blitDeny?: (key: string) => string | undefined }`
  - The plugin answers `/studio` by toggling the Pane.

- [ ] **Step 1: Git identity.** Run `gh auth status`. If it isn't logged in, stop and ask the person to run `! gh auth login`. Then:
  ```bash
  cd mascot-studio   # the repo root
  LOGIN=$(gh api user --jq .login); ID=$(gh api user --jq .id)
  git config user.name "$LOGIN"; git config user.email "$ID+$LOGIN@users.noreply.github.com"
  ```
  Expected: `git config user.email` prints `<id>+<login>@users.noreply.github.com`.

- [ ] **Step 2: Repo files.**
  - `.gitignore`: `**/.claude-plugin/types/`, `node_modules/`, `.DS_Store`, `Thumbs.db`.
  - `.gitattributes`: `* text=auto eol=lf`.
  - `marketplace.json`:
    ```json
    { "name": "mascot-studio", "owner": { "name": "<LOGIN from step 1>" },
      "plugins": [ { "name": "mascot-studio", "source": "./plugins/mascot-studio",
        "description": "A 2000s animation studio in your terminal: a pixel cat acts out what Claude is doing." } ] }
    ```
  - `scripts/sync-dev.sh <mods-folder>`: deletes `<mods-folder>/mascot-studio` and copies `plugins/mascot-studio` there, excluding `.claude-plugin/types` and `tests`.

- [ ] **Step 3: Manifest, hooks.json and contract.**
  - `plugin.json`: name, `"version": "0.1.0"`, the description above, `"author": { "name": "<LOGIN>" }`, `"license": "MIT"` and `"types": "./types/index.d.ts"`. Its `userConfig` holds the three fields from Global Constraints, each with `type`, `title`, `description` and `default`. This exact shape validated in the probe:
    ```json
    "openOnStartup": { "type": "boolean", "title": "Open on startup", "description": "Open the studio when a session starts", "default": true }
    ```
  - `hooks.json`: `{ "modules": ["./register.tsx"] }`.
  - `types/index.d.ts`: `export type Opener = 'startup' | 'person' | null` and `PluginState['mascot-studio'] = { opener: Opener }`. Later tasks add keys.

- [ ] **Step 4: Write the failing test** `tests/command.test.ts`:
  ```ts
  import { test, expect } from 'claude-code/testing'
  import { answerEngine, startSession } from './harness'
  test('/studio opens the pane, and closes it when open', async ($, on) => {
    const { rec } = answerEngine(on)
    await startSession($)
    rec.opened.length = 0
    expect(await $.command.run({ command: 'studio', args: '' } as never)).toMatchObject({ text: expect.stringContaining('opened') })
    expect(rec.opened).toEqual(['mascot-studio'])
    expect(await $.command.run({ command: 'studio', args: '' } as never)).toMatchObject({ text: expect.stringContaining('closed') })
    expect(rec.closed).toEqual(['mascot-studio'])
  })
  ```
  The harness keeps a set of open pane ids. `ui.open` adds to it and records; `ui.close` removes and records; `ui.panes` answers `[{ id, title, isPlaced: true }]` for each open id.

- [ ] **Step 5: Run it and confirm it fails.** Run `claude plugin test plugins/mascot-studio`. Expected: FAIL, because nothing registers `studio`.

- [ ] **Step 6: Implement in `register.tsx`.**
  - `session.start`: `$.command.register({ name: 'studio', description: 'Open or close Mascot Studio' })`, then `return next(e)`.
  - `command.run` `{ command: 'studio' }`:
    - Already open (`$.ui.panes()` lists the id): `$.ui.close({ id })` and answer `{ text: 'Mascot Studio closed.' }`.
    - Otherwise: write `opener: 'person'`, call `$.ui.open({ id, title: \`Mascot Studio MX · ${folder}.fla\` })`, and answer `{ text: 'Mascot Studio opened.' }`. `folder` is the cwd's last path segment, saved from `session.start`.
  - `ui.render` on the Pane: a single `<Text>Mascot Studio</Text>` placeholder.

- [ ] **Step 7: Run tests and validate.** Both `claude plugin test plugins/mascot-studio` and `claude plugin validate plugins/mascot-studio` pass, with no errors or warnings (`author` is set).

- [ ] **Step 8: Live loading check.**
  - Load the `plugin-authoring` skill. It names this session's mods folder.
  - Run `scripts/sync-dev.sh "<that folder>"`. The person is asked once "Enable hot reloading for this session?".
  - After they enable it, the next turn's notice reports the load. `/studio` then opens the placeholder pane.
  - Then run `npx -y -p typescript@5 tsc -p "<that folder>/mascot-studio"`. Expected: no errors. If that folder has no `tsconfig.json`, create `plugins/mascot-studio/tsconfig.json` as `{ "extends": "./.claude-plugin/types/tsconfig.json" }` and sync again.

- [ ] **Step 9: Commit** the spec, plan and scaffold:
  ```bash
  git add -A && git commit -m "Scaffold mascot-studio plugin with /studio toggle"
  ```
  The commit message ends with the `Co-Authored-By` line.

### Task 2: Pixel grids and raster cells

**Files:**
- Create: `hooks/art/pixels.ts`
- Test: `tests/pixels.test.ts`

**Interfaces:**
- Produces:
  - Constants: `TRANSPARENT = 0xFF000000`, `DEFAULT_COLOR = 0x01000000`.
  - `type Grid = { w: number; h: number; px: Uint32Array }`
  - `newGrid(w: number, h: number, fill: number): Grid`
  - `drawSprite(dst: Grid, src: Grid, x: number, y: number): void`, which skips `TRANSPARENT` and clips.
  - `fillRect(g: Grid, x: number, y: number, w: number, h: number, color: number): void`
  - `gridToCells(g: Grid): string`, a raster `w` columns by `h/2` rows. `h` must be even.
  - `textWords(text: string, cols: number, fg: number, bg: number | ((i: number) => number)): Uint32Array`, padded or cut to `cols`.
  - `wordsToCells(words: Uint32Array): string`
  - `sanitizeForRaster(text: string): string`

- [ ] **Step 1: Write the failing tests:**
  - `gridToCells` of a 1×2 grid (top `0xFF8800`, bottom `0x000000`) decodes to exactly `[0x2580, 0xFF8800, 0x000000]` (decode with `Uint8Array.fromBase64` and a `Uint32Array` view).
  - Any `TRANSPARENT` pixel becomes `DEFAULT_COLOR` in the cells.
  - `drawSprite` clips at the edges without throwing: a 4×4 sprite at (-2, -2) on a 3×3 grid.
  - `textWords('ab', 4, 1, 2)` gives code points `a b space space`.
  - `sanitizeForRaster('日本 🎵 é\tx')` equals `'?? ? é x'`. Wide CJK and astral characters become `?`, and tab becomes a space.
  - A string of 300 `a` passed to `textWords(…, 10, …)` gives exactly 30 words.

- [ ] **Step 2: Run it and confirm it fails.** `claude plugin test plugins/mascot-studio` fails on the import.

- [ ] **Step 3: Implement.** `sanitizeForRaster` maps each code point:
  - Controls (U+0000–001F and U+007F–009F) and tab → space.
  - Mapped to `?`:
    - Above U+FFFF.
    - Combining marks U+0300–036F.
    - Wide ranges: U+1100–115F, U+2E80–A4CF, U+AC00–D7A3, U+F900–FAFF, U+FE30–FE4F, U+FF00–FF60, U+FFE0–FFE6.
    - Surrogates.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: pixel grids and half-block raster packing`.

### Task 3: Calendar helpers

**Files:**
- Create: `hooks/calendar.ts`
- Test: `tests/calendar.test.ts`

**Interfaces:**
- Consumes: `Hat` from `types/index.d.ts`. Add `export type Hat = 'beanie' | 'pumpkin' | 'santa' | 'party' | 'heart'` there.
- Produces:
  - `hatFor(d: Date): Hat`, using local date getters.
  - `formatReset(iso: string | undefined, now: Date): string`
  - `formatElapsed(ms: number): string`

- [ ] **Step 1: Write the failing tests:**
  - `hatFor`:
    - Oct 5 → `'pumpkin'`.
    - Oct 31 → `'pumpkin'`.
    - Dec 1 → `'santa'`.
    - Jan 1 → `'party'`.
    - Jan 2 → `'beanie'`.
    - Feb 14 → `'heart'`.
    - Jul 4 → `'beanie'`.
  - `formatReset`:
    - Reset at 16:10 on the same local day → `'4:10 PM'`.
    - Reset next Monday at 09:00 → `'Mon 9:00 AM'`.
    - Reset at 00:05 → `'12:05 AM'`.
    - `undefined`, `'garbage'` and a time in the past → `''`.
  - `formatElapsed`: 42000 → `'0:42'`; 3723000 → `'62:03'`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** Use `Date` getters only, with no `Intl`. Day names are `Sun Mon Tue Wed Thu Fri Sat`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: hats by date and time formatting`.

### Task 4: Activity model

**Files:**
- Create: `hooks/activity.ts`
- Modify: `types/index.d.ts`
- Test: `tests/activity.test.ts`

**Interfaces:**
- Produces, in the contract:
  - `export type Pose = 'thinking'|'magnify'|'tablet'|'keyboard'|'browser'|'helper'|'facepalm'|'wave'|'hop'|'asleep'`
  - `export type Keyframe = { id: string; n: number; tool: string; target: string; pose: Pose; startedAt: number; durationMs?: number; isError?: boolean; errorLine?: string }`
  - `export type Activity = { pose: Pose; tool?: string; target?: string; since: number }`
- Produces, in `activity.ts`:
  - `poseForTool(tool: string): Pose`
  - `targetOf(input: Readonly<Record<string, unknown>>): string`
  - `firstLine(text: string): string`
  - `truncateMiddle(text: string, max: number): string`, using `…` in the middle.
  - `startKeyframe(list: readonly Keyframe[], start: Omit<Keyframe, 'n'>): Keyframe[]`, with `n` = last `n` + 1, keeping the newest 200.
  - `finishKeyframe(list: readonly Keyframe[], id: string, end: { durationMs: number; isError: boolean; errorLine?: string }): Keyframe[]`
  - `timelineWindow(current: number, width: number): { start: number; end: number }`
  - `layerCells(keys: ReadonlySet<number> | 'all', win: { start: number; end: number }, current: number): ('key'|'span'|'playhead'|'future')[]`

- [ ] **Step 1: Write the failing tests:**
  - `poseForTool` covers every row of spec §5. Include `'mcp__claude-in-chrome__navigate'` → `'browser'`, `'Agent'` → `'helper'` and `'Frobnicate'` → `'tablet'`.
  - `targetOf` field priority:
    - `{ command: 'npm test\nmore' }` → `'npm test'`.
    - `{ file_path: '/a/b.ts', pattern: 'x' }` → `'/a/b.ts'`.
    - `{}` → `''`.
  - `truncateMiddle('hooks/views/studio.tsx', 12)` has length 12 and contains `'…'`.
  - Running `startKeyframe` 205 times keeps 200 entries, with the last one's `n` equal to 205.
  - Out-of-order finish: start `a`, `b` and `c`; finish `c` then `a`. `c` and `a` get their own durations and `b` stays unfinished.
  - `timelineWindow`:
    - `(5, 36)` → `{ start: 1, end: 36 }`.
    - `(40, 36)` → `{ start: 13, end: 48 }`, so the playhead sits 8 frames from the right edge.
  - `layerCells('all', {start:1,end:5}, 3)` → `['key','key','playhead','future','future']`.
  - `layerCells(new Set([1]), {start:1,end:4}, 3)` → `['key','span','playhead','future']`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** Target priority: `file_path, path, notebook_path, pattern, url, query, command (first line), description`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: activity model (poses, targets, keyframes, timeline window)`.

### Task 5: Sprites

**Files:**
- Create: `hooks/art/sprites.ts`
- Modify: `types/index.d.ts`, adding `export type MiniMood = 'relaxed'|'squint'|'sweat'|'flat'|'asleep'`
- Test: `tests/sprites.test.ts`

**Interfaces:**
- Consumes: `Grid` and `newGrid` / `drawSprite` (Task 2); `Pose` and `Hat`.
- Produces:
  - `PALETTE: Readonly<Record<string, number>>`, where `'.'` means transparent.
  - `type SpriteFrame = { rows: readonly string[]; headY?: number }`
  - `MASCOT: Readonly<Record<Pose, readonly SpriteFrame[]>>`
  - `HATS: Readonly<Record<Hat, readonly string[]>>`
  - `MINI: Readonly<Record<MiniMood, readonly SpriteFrame[]>>`
  - `DJ: Readonly<Record<'dance'|'sway'|'doze', readonly SpriteFrame[]>>`
  - `spriteGrid(rows: readonly string[]): Grid`
  - `composeMascot(pose: Pose, hat: Hat, tick: number): Grid`, which is 24×24.

- [ ] **Step 1: Write the failing tests:**
  - **Frame counts:**
    - `thinking` 2, `magnify` 4, `tablet` 4, `keyboard` 2, `browser` 4, `helper` 4, `facepalm` 2, `wave` 2, `hop` 4, `asleep` 2.
    - `MINI`: 2 frames per mood.
    - `DJ`: `dance` 4, `sway` 2, `doze` 2.
  - **Sizes:** every `MASCOT` frame is 24 rows of 24 chars; every `HATS` entry is 8 rows of 24; every `MINI` frame is 8×8; every `DJ` frame is 10×10.
  - **Valid art:** every character in every row is a `PALETTE` key, and every `MASCOT` frame has a `headY` from 0 to 16.
  - **Hats move with the head:** `composeMascot('hop', 'santa', t)` differs from `composeMascot('hop', 'beanie', t)` only in rows `headY` to `headY+7`.

- [ ] **Step 2: Run it and confirm it fails.**

- [ ] **Step 3: Draw the art.** All of it is original pixel art and must be legible at half-block resolution.
  - **Palette keys:**

    | Key | Color | Use |
    |---|---|---|
    | `k` | `#1A1A1A` | outline |
    | `g` | `#8C8C8C` | fur |
    | `G` | `#B5B5B5` | light fur |
    | `s` | `#5E5E5E` | stripes |
    | `w` | `#FFFFFF` | white |
    | `p` | `#F2A0B5` | nose |
    | `e` | `#2BB24C` | eyes |
    | `n` | `#3C3C46` | charcoal beanie |
    | `N` | `#5A5A6A` | beanie band |
    | `o` | `#F28C28` | pumpkin |
    | `r` | `#D42A2A` | Santa red |
    | `y` | `#F2D43C` | party yellow |
    | `h` | `#E0457B` | heart |
    | `t` | `#2E2E2E` | tablet |
    | `c` | `#4DA3FF` | screen |
    | `m` | `#C8A060` | magnifier rim |
    | `b` | `#3366CC` | globe blue |
    | `l` | `#66CC66` | globe land |
    | `d` | `#7A3FA0` | DJ blob |
    | `D` | `#A060C8` | DJ light |
    | `z` | `#000000` | headphones |

  - **Pose content:**
    - `thinking`: a `?` bubble.
    - `asleep`: `Zzz`.
    - `hop`: the body is drawn at y offsets 0, -2, -3 and -1 within the 24×24 frame. `headY` changes to match.
    - `helper`: a tiny second cat runs in from the right.
    - Each pose's prop is drawn into the pose frames.
  - **Hat layout:** a hat row's `.` is transparent and is overlaid at `(0, headY)`.

- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Preview.** Write a temporary test that logs `composeMascot` for every pose and frame as `▀` text with ANSI truecolor, and check it by eye. Delete it afterwards.
- [ ] **Step 6: Commit** `feat: original pixel art for mascot, hats, mini mascot and DJ blob`.

### Task 6: Stage frame and animator core

**Files:**
- Create: `hooks/art/stage.ts`, `hooks/animator.ts`
- Test: `tests/stage.test.ts`

**Interfaces:**
- Consumes: `composeMascot` (Task 5); `newGrid`, `fillRect`, `drawSprite` and `gridToCells` (Task 2).
- Produces:
  - `stageCells(o: { cols: number; rows: number; pose: Pose; hat: Hat; tick: number }): string`
  - `type RasterFrame = { key: string; columns: number; rows: number; cells: string }`
  - `type AnimModel = { stage?: { cols: number; pose: Pose; hat: Hat; screensaver: null } }`. Later tasks widen this: Task 11 adds `tm`, Task 17 adds `amp`, Task 19 makes `screensaver` a `ScreensaverKind | null`.
  - `rasterFrames(m: AnimModel, tick: number, now: number): RasterFrame[]`, with keys from the set `'stage'|'tm-title'|'ctx-meter'|'ctx-graph'|'lcd'|'viz'|'dj'`. `now` lets time-based art (the mini mascot falling asleep, Task 11) change without a redraw.

- [ ] **Step 1: Write the failing tests:**
  - **Size:** `stageCells({cols:46, rows:12, …})` decodes to 46×12×3 words.
  - **Work area:** column 0 is work-area grey `0x9A9A9A` in both halves.
  - **Canvas:** the center column contains canvas white `0xFFFFFF`.
  - **Narrow:** at `cols: 24` there is no grey column, because the canvas fills the width.
  - **Animation:** two different `tick`s of `tablet` produce different cells.
  - **One raster:** `rasterFrames({ stage: {cols:46, …} }, 0, 0)` returns exactly one frame, `{ key: 'stage', columns: 46, rows: 12 }`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - The canvas is `min(cols, 40)` wide, centered, the full height minus one pixel row top and bottom.
  - A 1 px `#666666` shadow sits on the canvas's right and bottom edges.
  - The mascot is horizontally centered on the canvas and bottom-aligned.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: stage frame composer and animator`.

### Task 7: Activity wiring into session state

**Files:**
- Modify: `hooks/register.tsx`, `types/index.d.ts`, `tests/harness.ts`
- Test: `tests/activity-wiring.test.ts`

**Interfaces:**
- Consumes: Task 4's `poseForTool`, `targetOf`, `startKeyframe` and `finishKeyframe`; `firstLine` for error lines.
- Produces:
  - **New contract keys:** `activity: Activity`, `keyframes: Keyframe[]`, `selectedFrame: number | null`, `scene: Scene` (`export type Scene = 1 | 2`), `turnStartedAt: number | null`, `idleSince: number | null`, `turns: number`.
  - **Behaviour:**
    - `tool.call` (any loop): in a pre-step, write the pose, a new keyframe (`id = e.tool_use_id ?? \`k${n}\``) and `idleSince: null`. In a post-step, finish the keyframe. The result goes back unchanged.
    - `turn.start`: pose `thinking`, `scene: 1`, `turnStartedAt: now`, `idleSince: null`.
    - `turn.complete`, main loop only (`e.agentId === undefined`):
      1. Pose `hop`.
      2. `turns + 1`.
      3. `turnStartedAt: null`.
      4. After 1500 ms, `scene: 2`, pose `asleep` and `idleSince: now`.
    - After a tool call ends while a turn runs, the pose returns to `thinking`, but only when no other keyframe is still unfinished (no `durationMs`). Parallel calls keep the pose of the most recently started one (spec §5).

- [ ] **Step 1: Write the failing tests** (the harness answers `turn.start`, `turn.complete` and `tool.call` as listed in Verified engine facts):
  - **Pass-through:** `$.tool.call({ tool: 'Read', tool_use_id: 'u1', file_path: '/a.ts' })` resolves `{ text: 'ok' }`, exactly what the test's bottom hook returned.
  - **Keyframes and pose:** after two calls, a mounted pane (Task 8) isn't needed yet. Read through a debug Text instead: the placeholder render prints `pose=<pose> frames=<n>`. Expect `pose=thinking frames=2` after `turn.start` plus two calls.
  - **Errors recorded:** a bottom `tool.call` answering `{ text: 'boom\nstack', isError: true }` records `isError` and `errorLine: 'boom'`. The placeholder prints `err=boom`.
  - **Hop, then Scene 2:** `turn.complete` with `answer: 'done'` gives `pose=hop`. After `clock.advance(1500)`: `pose=asleep scene=2`.
  - **Subagents ignored:** `turn.complete` with `agentId: 'a1'` changes nothing.
  - **Parallel calls:** start calls `p1` and `p2`, keeping both bottoms pending, then settle `p1` first. The pose stays the one `p2` set; once `p2` settles, the pose is `thinking`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement** the atoms and hooks in `register.tsx`. Every state write uses `update($, atom, fn)`. Each observing hook has `try/catch` around its own work and `.catch(($, e, next) => next(e))`.
- [ ] **Step 4: Run it and confirm it passes. Validate.**
- [ ] **Step 5: Commit** `feat: wire tool and turn events into session state`.

### Task 8: Studio view, render hook, ticker and inspector

**Files:**
- Create: `hooks/layout.ts`, `hooks/views/studio.tsx`, `hooks/views/timeline.tsx`
- Modify: `hooks/register.tsx`, `tests/harness.ts`
- Test: `tests/layout.test.ts`, `tests/studio-ui.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 6 and 7; `formatElapsed` (Task 3); `hatFor` (Task 3).
- Produces:
  - `layoutFor(cols: number, rows: number, scene: Scene, amp: boolean): Layout`, where `Layout = { tooNarrow: boolean; menu: boolean; props: 'full'|'line'; amp: 'full'|'line'|'none'; tmBoxes: boolean }`.
  - `studioView(els: Elements['terminal'], vm: StudioVM, act: StudioActions)`
  - `StudioVM = { cols: number; layout: Layout; scene: Scene; keyframes: readonly Keyframe[]; soundFrames: readonly number[]; current: number; selected: Keyframe | null; activity: Activity; elapsed: string; visitors: number | null; frames: Readonly<Record<string, RasterFrame>> }`. Later tasks extend it: Task 12 adds `tm`, Task 17 adds `amp`, Task 18 adds `dialog`.
  - `StudioActions = { selectFrame(n: number): void; live(): void; toggleScene(): void }`. Later tasks extend it.
  - **Element keys:**
    - Buttons: `kf-<n>`, plain `●`, red `●` when `isError`.
    - `live`: plain `█`, red, hotkey `l`.
    - `scene`: plain `Scene 1 | Scene 2` with the current scene bold, hotkey `t`.
    - Rasters by `RasterFrame.key`.
    - Section Boxes: `menu`, `timeline`, `stage`, `properties`.

- [ ] **Step 1: Write the failing `layoutFor` tests** (heights per spec §4):

  | Call | Expected |
  |---|---|
  | `layoutFor(46, 30, 1, true)` | everything full |
  | `layoutFor(46, 23, 1, true)` | `amp: 'line'`, menu shown |
  | `layoutFor(46, 22, 1, true)` | `amp: 'line'`, `menu: false` |
  | `layoutFor(46, 21, 1, true)` | additionally `props: 'line'` |
  | `layoutFor(46, 22, 2, true)` | `tmBoxes: false` |
  | `layoutFor(31, 40, 1, true)` | `tooNarrow: true` |
  | `amp: false` | `amp: 'none'` regardless of rows |

  Constants:
  - Menu 1.
  - Timeline 5.
  - Stage section 13 in Scene 1 and 16 in Scene 2.
  - Properties section 3, or 2 as one line.
  - Amp section 4, or 1 as one line.

  The collapse order is amp → menu → props → tmBoxes. Each step applies only while the total exceeds `rows`.

- [ ] **Step 2: Write the failing UI tests** with `mountPane` at 46×30 after `turn.start` and three tool calls:
  - **Structure:** `findAll({ type: 'Button', text: '●' })` has length 3, and a Raster with key `stage` exists with `columns: 46, rows: 12`.
  - **Inspector:** pressing `kf-2` shows `Text` containing the second call's tool and target, plus `✓` and a duration. Pressing `live` returns to the live tool.
  - **Scene switch:** pressing `scene` switches to Scene 2. The Stage raster is absent; Scene 2 shows the `Task Manager` placeholder Text until Task 12.
  - **Narrow:** mounting at 31 columns shows only `Widen the pane to see the studio.`
  - **Animation:** advancing the clock 166 ms records a blit for `stage` in `rec.blits`.
  - **Resize (Review Focus 2):**
    1. `blitDeny` returns `'size'` for `stage`.
    2. After one tick, no more `stage` blits are recorded on the next ticks.
    3. After `ui.redraw()`, blits resume.
  - **Placement:** the same tests pass at 60×30 and 32×20.

- [ ] **Step 3: Run them and confirm they fail.** Also rewrite `tests/activity-wiring.test.ts`, which read Task 7's placeholder line. It now asserts through the real view: the Properties Text `Pose <words>`, the count of `●` keyframe buttons, `✖` for errors, and the scene via the presence of the `stage` raster.
- [ ] **Step 4: Implement.**
  - **Render hook:** reads every atom with `read($, …)` and builds the VM. It computes `frames` with `rasterFrames` at the module's current `tick`, then calls `studioView`. It stores `{ model, mounted: Set(keys) }` in a module variable for the ticker.
  - **Ticker:** started in `session.start` with `$.clock.every(166, …)`. Each tick does `tick++`, refreshes the module-level `now` from `$.clock.now()`, and blits each mounted frame from `rasterFrames(model, tick, now)`. On `{ deny }` it removes the key from `mounted`.
  - **Footer:** `Scene 1 | Scene 2 · frame <current> · <elapsed while a turn runs> · visitor #<6 digits>`. Parts are dropped from the right to fit, and the visitor part is omitted while `visitors` is `null`.
  - **Menu bar:** `File  Edit  View  Insert  Modify  Control`, drawn dim and cut to width.
  - **Properties:** `Tool <tool>  Pose <pose words>` / `Target <truncateMiddle(target, cols-9)>`. The pose words are:
    - `thinking`: "thinking"
    - `magnify`: "magnifier"
    - `tablet`: "pen tablet"
    - `keyboard`: "keyboard"
    - `browser`: "browser"
    - `helper`: "calling a helper"
    - `facepalm`: "facepalm"
    - `wave`: "waving"
    - `hop`: "export movie"
    - `asleep`: "asleep"
- [ ] **Step 5: Run them and confirm they pass.** Validate. Sync to the mods folder and check by eye in a live session: run a few tools and watch the poses change.
- [ ] **Step 6: Commit** `feat: studio pane view, ticker and keyframe inspector`.

### Task 9: Startup, settings and surfaces

**Files:**
- Modify: `hooks/register.tsx`, `tests/harness.ts`
- Test: `tests/startup.test.ts`

**Interfaces:**
- Consumes: the `opener` key (Task 1).
- Produces: startup behaviour per spec §3.

- [ ] **Step 1: Write the failing tests:**
  - With default options, `startSession` opens the pane (`rec.opened` is `['mascot-studio']`) and writes `opener: 'startup'`.
  - `test('…', { options: { openOnStartup: false } }, …)`: nothing is opened.
  - `surfaces: ['desktop']`: nothing is opened, and `/studio` answers `{ text: 'Mascot Studio runs in the terminal for now.' }`.
  - **Inline startup pane:** after startup, mounting with `placement: 'inline'` closes the pane (`rec.closed`) and toasts exactly `Mascot Studio: type /studio to open it.` once. Mounting inline after `/studio` (opener `person`) does not close it.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - On inline placement with opener `startup`, the render returns an empty `Box` and schedules `$.clock.after(0, …)`.
  - That callback closes the pane, sends the toast, and writes `opener: null`.
- [ ] **Step 4: Run it and confirm it passes. Validate.**
- [ ] **Step 5: Commit** `feat: open on startup with inline fallback and terminal-only guard`.

---

## Milestone 2 — Task Manager scene

### Task 10: Usage model

**Files:**
- Create: `hooks/usage.ts`, `hooks/alerts.ts`
- Modify: `types/index.d.ts`
- Test: `tests/usage.test.ts`

**Interfaces:**
- Consumes: `formatReset` (Task 3).
- Produces, in the contract:
  - `RateLimitView = { kind: string; percentUsed: number; resetsAt?: string }`
  - `UsageSnapshot = { contextPercent?: number; contextTokens?: number; rateLimits: RateLimitView[]; costUsd?: number; toolCalls: number }`
  - `Dialog = { kind: 'error'; tool: string; line: string; at: number } | { kind: 'needs-you'; text: string; at: number } | null`
- Produces, in `usage.ts`:
  - `snapshotFrom(raw: { context: { tokens?: number; percent?: number }; rateLimits: readonly RateLimitView[]; cost?: { usd: number } }, toolCalls: number): UsageSnapshot`
  - `level(pct: number | undefined): 'ok'|'warn'|'critical'`
  - `highestPercent(s: UsageSnapshot): number | undefined`
  - `costLabel(s): 'Est. cost'|'Cost'`
  - `limitsView(s, now: Date): { fiveHour?: number; weekly?: number; reset: string; isApiKey: boolean }`
  - `usageWarning(s, now: Date): string | undefined`
  - `miniMood(highest: number | undefined, quietMs: number): MiniMood`
  - `pushHistory(list: readonly number[], pct: number | undefined, max: number): number[]`
- Produces, in `alerts.ts`: `statusLine(dialog: Dialog, warning: string | undefined): string | undefined`.

- [ ] **Step 1: Write the failing tests:**
  - **`level`:** 79 → `'ok'`, 80 → `'warn'`, 95 → `'critical'`, `undefined` → `'ok'`.
  - **`costLabel`:** `'Est. cost'` when `rateLimits` is non-empty, else `'Cost'`.
  - **`limitsView`:**
    - `isApiKey` is true when there are no limits.
    - `reset` is the soonest of the `five_hour` and `seven_day` resets, formatted with `formatReset`.
  - **`usageWarning`:**
    - Context 84 → `'ᓚᘏᗢ context 84% · consider /compact'`.
    - 5-hour 82 resetting today at 16:10 → `'ᓚᘏᗢ 5-hour limit 82% · resets 4:10 PM'`.
    - Both present: the higher wins.
    - Nothing at or above 80 → `undefined`.
  - **`miniMood`:**
    - `(30, 0)` → `'relaxed'`, `(60, 0)` → `'squint'`, `(85, 0)` → `'sweat'`, `(100, 0)` → `'flat'`.
    - Any mood with `quietMs >= 60000` → `'asleep'`.
  - **`pushHistory`:** keeps the last `max` and skips `undefined`.
  - **`statusLine`:**
    - needs-you → `'ᓚᘏᗢ Mascot is waiting on you'`, even with a warning present.
    - Error dialog plus warning → the warning.
    - Neither → `undefined`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: usage snapshot, thresholds and status-line priority`.

### Task 11: Task Manager instruments

**Files:**
- Create: `hooks/art/instruments.ts`
- Modify: `hooks/animator.ts`
- Test: `tests/instruments.test.ts`

**Interfaces:**
- Consumes: Task 2's pixel helpers; `MINI` (Task 5); `level` (Task 10).
- Produces:
  - `ledMeterCells(pct: number | undefined, cols: number, rows: number): string`
  - `historyCells(samples: readonly number[], cols: number, rows: number, mini: { mood: MiniMood; tick: number }): string`
  - `titleBarCells(text: string, cols: number): string`
  - `AnimModel.tm = { meterCols: 7; meterRows: 4; graphCols: number; graphRows: 5; titleCols: number; samples: number[]; pct?: number; highest?: number; idleSince: number | null; title: string }`
  - `rasterFrames` now also returns `tm-title`, `ctx-meter` and `ctx-graph` when `m.tm` is set. The mini mascot's mood is `miniMood(highest, idleSince === null ? 0 : now - idleSince)`, computed per frame.
  - Test this too: `rasterFrames` with `idleSince: 0` gives a `ctx-graph` that differs between `now: 1000` and `now: 61000`, because the mascot is asleep at the second.

- [ ] **Step 1: Write the failing tests:**
  - **LED meter:**
    - 0% has no bright green `0x00FF00` cell.
    - At 50%, the bottom half of the rows contains bright green and the top half doesn't.
    - At 85% the lit color is amber `0xFFB000`; at 97% it's red `0xFF3030`.
  - **History graph:**
    - Its background is black `0x000000`, with the grid color `0x008040` every 4th pixel column.
    - The newest sample is plotted in the rightmost pixel column at height `round(pct/100 * (rows*2-1))`.
    - The mini mascot's 8×8 sprite is drawn ending at the rightmost column, standing on the newest point.
  - **Title bar:**
    - `titleBarCells('Task Manager', 40)`: cell 1 holds the code point `T` in white `0xFFFFFF`.
    - Cell 0's background is `0x0A246A`, and the last cell's background is `0xA6CAF0`.
    - The text passes through `sanitizeForRaster`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** The gradient is linear per channel across `cols`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: task manager meters, history graph and title bar`.

### Task 12: Task Manager wiring and Scene 2 view

**Files:**
- Create: `hooks/views/taskManager.tsx`
- Modify: `hooks/register.tsx`, `hooks/views/studio.tsx`, `types/index.d.ts`, `tests/harness.ts`
- Test: `tests/taskmgr.test.ts`

**Interfaces:**
- Consumes: Tasks 10 and 11.
- Produces:
  - **Contract keys:** `usage: UsageSnapshot`, `contextHistory: number[]`, `dialog: Dialog` (always `null` until Task 18).
  - **Hooks:** `session.start` and `session.measure` (observe) read `$.session.usage()` into `usage`. On main-loop `turn.complete`, `pushHistory(contextHistory, usage.contextPercent, 120)` runs.
  - **Status line:** after any write to `usage` or `dialog`, `$.ui.status(statusLine(dialog, usageWarning(usage, now)))` is called only when the text changed.
  - `taskManagerView(els, tm: TaskManagerVM, frames)`, where `TaskManagerVM = { cols: number; boxes: boolean; pct?: number; limits: ReturnType<typeof limitsView>; costLabel: string; costUsd?: number; turns: number; toolCalls: number }`.

- [ ] **Step 1: Write the failing tests.** The harness `usage` option answers `session.usage` with:
  ```ts
  { startedAt: 0, context: { tokens: 84000, window: 200000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 31, resetsAt: '<today 16:10 local ISO>' }, { kind: 'seven_day', percentUsed: 18 }], cost: { usd: 0.84 } }
  ```
  - **Scene 2:** after `turn.complete` and 1500 ms, mount at 46×30 and expect:
    - Text `42 %`.
    - Text matching `/5-hour .* 31%/` and `/Weekly .* 18%/`.
    - Text `resets 4:10 PM`.
    - Text matching `/Est\. cost\s+\$0\.84/`.
    - Text matching `/Tools: \d+\s+Context: 42%\s+5-hour: 31%/`.
    - Rasters `tm-title`, `ctx-meter` and `ctx-graph`.
  - **API key:** with `rateLimits: []`, expect `No plan limits (API key)` and `Cost`.
  - **Warnings:**
    - `session.measure` with context 84 → the last `rec.statuses` entry is `'ᓚᘏᗢ context 84% · consider /compact'`.
    - Dropping back to 40 → `undefined`.
  - **Missing figures:** a usage without `percent` shows `— %` and doesn't throw.
  - **Failed read:** after a good read, a `session.usage` answered `{ deny: 'x' }` on the next `session.measure` keeps showing `42 %` (spec §11).
  - **Short pane:** mounted at 46×22 in Scene 2, there are no `Limits`/`Totals` boxes, and the status line Text still shows.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** Layout follows spec §7:
  - Title raster, then tabs Text `Applications   Processes  [Performance]`.
  - A row of the Context box (meter raster plus `NN %` Text) and the Context History box (graph raster, width `cols - 15`).
  - A row of the Limits and Totals boxes (`borderStyle="single"`).
  - The status Text.
  - Limit bars are 9 cells of `█` and `░` colored by `level`.
- [ ] **Step 4: Run it and confirm it passes. Validate.** Do a live visual check.
- [ ] **Step 5: Commit** `feat: task manager scene with live usage`.

---

## Milestone 3 — Sound

### Task 13: Sound contracts, OS detection and supervisor

**Files:**
- Create: `hooks/sound/types.ts`, `hooks/sound/platform.ts`, `hooks/sound/supervisor.ts`
- Modify: `types/index.d.ts`
- Test: `tests/supervisor.test.ts`

**Interfaces:**
- Produces, in the contract: `Track`, `SoundStatus` and `SoundAction`, exactly as in spec §9.
- Produces, in `types.ts`:
  - `SoundHost = { run(argv: readonly string[], timeoutMs?: number): Promise<{ exitCode: number; stdout: string; stderr: string }>; spawn(argv: readonly string[]): AsyncIterable<{ stream: 'stdout'|'stderr'; text: string }>; every(ms: number, fn: () => void): { cancel(): void }; after(ms: number, fn: () => void): { cancel(): void }; now(): number }`
  - `SoundBackend = { watch(host: SoundHost, onStatus: (s: SoundStatus) => void): () => void; control(host: SoundHost, action: SoundAction, track?: Track): Promise<boolean> }`
- Produces, in `platform.ts`: `type Os = 'windows'|'macos'|'linux'|'other'` and `detectOs(osEnv: string | undefined, uname: () => Promise<string>): Promise<Os>`.
- Produces, in `supervisor.ts`:
  - `LineBuffer` class with `push(text: string): string[]`, returning complete lines without `\r`.
  - `backoffDelay(failureTimes: readonly number[], now: number): number | 'stop'`
  - `watchLines(host: SoundHost, argv: readonly string[], parse: (line: string) => SoundStatus | null, onStatus: (s: SoundStatus) => void): () => void`

- [ ] **Step 1: Write the failing tests:**
  - **`detectOs`:**
    - `'Windows_NT'` → `'windows'`, without calling `uname`.
    - `uname` returning `'Darwin\n'` → `'macos'`; `'Linux'` → `'linux'`; `'FreeBSD'` → `'other'`.
  - **`LineBuffer`:** pushing `'a\r\nb'` then `'c\n'` yields `['a']`, then `['bc']`.
  - **`backoffDelay`:**
    - 1 failure → 1000; 2 → 2000; 3 → 4000; 4 → 8000.
    - 5 failures within 120000 ms → `'stop'`.
    - 5 failures spread over 10 minutes → 60000.
  - **`watchLines`**, with a fake host whose `spawn` yields `'{"x":1}\n'` and then ends:
    - It calls `parse` once.
    - It restarts after 1000 ms (fake `after`).
    - After 5 quick exits it emits `{ kind: 'stopped' }`.
    - The returned stop function prevents further restarts.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - A child that ran at least 60 s before exiting clears the failure list.
  - Stop calls `return()` on the active iterator.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: sound contracts, OS detection and helper supervisor`.

### Task 14: Windows backend (media session)

**Files:**
- Create: `hooks/sound/windows.ts`
- Test: `tests/sound-windows.test.ts`

**Interfaces:**
- Consumes: Task 13.
- Produces:
  - `windowsBackend: SoundBackend`
  - `encodePowerShell(script: string): string`, UTF-16LE then base64.
  - `parseSmtcLine(line: string): SoundStatus | null`
  - `appName(id: string): string`
  - `WATCH_SCRIPT: string`
  - `controlScript(action: SoundAction): string`

- [ ] **Step 1: Write the failing tests:**
  - **`parseSmtcLine`:**
    - `'{"none":true}'` → `{ kind: 'nothing' }`.
    - `'{"app":"Spotify.exe","title":"One More Time","artist":"Daft Punk","status":"Playing"}'` → `playing` with app `Spotify`.
    - `"Paused"` → `paused`; `"Stopped"` → `nothing`.
    - `'{"app":"x","title":"Beyonc\\u00e9","artist":"a","status":"Playing"}'` → title `Beyoncé` (Review Focus 4).
    - `'not json'` → `null`.
  - **`appName`:**
    - `'Spotify.exe'` → `Spotify`; `'chrome'` → `Chrome`; `'msedge'` → `Edge`; `'firefox'` → `Firefox`.
    - `'C:\\Apps\\Tidal.exe'` → `Tidal`.
    - `'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic'` → `Media Player`.
  - **Scripts:**
    - `WATCH_SCRIPT` contains `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`.
    - `controlScript('next')` contains `TrySkipNextAsync`.
  - **`encodePowerShell('A')`** → `'QQA='`.
  - **Spawn argv:** `watch` with a fake host spawns argv `['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand', encodePowerShell(WATCH_SCRIPT)]`.
  - **Control:** `control(host, 'play-pause')` calls `run` with the same prefix and resolves `true` on exit 0, `false` otherwise.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** The scripts are fixed PowerShell 5.1. Write them exactly as follows:
  ```powershell
  # shared prelude (both scripts)
  $ErrorActionPreference = 'Stop'
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
  function Await($op, [Type]$type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
  [void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  # WATCH_SCRIPT body
  $last = ''
  while ($true) {
    $s = $mgr.GetCurrentSession()
    if ($null -eq $s) { $line = '{"none":true}' } else {
      $p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $line = [pscustomobject]@{ app = $s.SourceAppUserModelId; title = $p.Title; artist = $p.Artist; status = $s.GetPlaybackInfo().PlaybackStatus.ToString() } | ConvertTo-Json -Compress
    }
    if ($line -ne $last) { [Console]::Out.WriteLine($line); [Console]::Out.Flush(); $last = $line }
    Start-Sleep -Milliseconds 1000
  }
  # controlScript(action) body: <Method> is TryTogglePlayPauseAsync | TrySkipNextAsync | TrySkipPreviousAsync
  $s = $mgr.GetCurrentSession(); if ($null -ne $s) { [void](Await ($s.<Method>()) ([bool])) }
  ```
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Live check (Windows only).** With music playing, run the watch script manually:
  ```bash
  powershell.exe -NoProfile -EncodedCommand <encoded>
  ```
  Expected: a JSON line showing the current track. Stop it with Ctrl+C.
- [ ] **Step 6: Commit** `feat: Windows media-session sound backend`.

### Task 15: Linux backend (playerctl)

**Files:**
- Create: `hooks/sound/linux.ts`
- Test: `tests/sound-linux.test.ts`

**Interfaces:**
- Consumes: Task 13.
- Produces: `linuxBackend: SoundBackend`, `parsePlayerctlLine(line: string): SoundStatus | null` and `playerName(raw: string): string`.

- [ ] **Step 1: Write the failing tests:**
  - **`parsePlayerctlLine`:**
    - `'Playing\tspotify\tDaft Punk\tOne More Time'` → `playing`, app `Spotify`.
    - `'Paused\tfirefox\ta\tb'` → `paused`.
    - `'Stopped\tvlc\t\t'` → `nothing`.
    - `''` → `nothing`.
    - A line with 2 fields → `null`.
  - **`playerName`:**
    - `'vlc'` → `VLC`; `'chromium'` → `Chromium`.
    - `'spotify.instance123'` → `Spotify`, dropping the instance suffix.
  - **Missing playerctl:** `watch` with a fake host whose `run(['playerctl','--version'])` rejects emits `{ kind: 'unavailable', reason: 'missing-playerctl' }` and never spawns.
  - **Spawn argv:** otherwise it spawns `['playerctl','--follow','metadata','--format','{{status}}\t{{playerName}}\t{{artist}}\t{{title}}']`.
  - **Control:** `control(host,'previous')` runs `['playerctl','previous']`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: Linux playerctl sound backend`.

### Task 16: macOS backend (pgrep + AppleScript)

**Files:**
- Create: `hooks/sound/macos.ts`
- Test: `tests/sound-macos.test.ts`

**Interfaces:**
- Consumes: Task 13.
- Produces:
  - `macosBackend: SoundBackend`
  - `appScript(app: 'Music'|'Spotify'): string`
  - `parseAppleScript(app: string, out: string): Track & { state: 'playing'|'paused' } | null`
  - `choosePlayer(readings: readonly (Track & { state: 'playing'|'paused' })[], lastPausedApp: string | null): SoundStatus`

- [ ] **Step 1: Write the failing tests:**
  - **`parseAppleScript`:**
    - `('Spotify', 'playing\tDaft Punk\tOne More Time')` → a playing track.
    - `'stopped'` → `null`.
  - **`choosePlayer`:**
    - With Music paused and Spotify playing → Spotify playing.
    - Two paused players with `lastPausedApp: 'Music'` → Music paused.
    - No readings → `nothing`.
  - **Polling**, with a fake host where `run(['pgrep','-x','Spotify'])` exits 0 and `run(['pgrep','-x','Music'])` exits 1:
    - It runs `osascript -e appScript('Spotify')` only.
    - It polls every 2000 ms via `every`.
  - **Automation denied:** an osascript stderr containing `-1743` → `{ kind: 'unavailable', reason: 'automation-denied' }`.
  - **Control:** `control(host,'next', { app: 'Music', … })` runs `['osascript','-e','tell application "Music" to next track']`. The other actions map to `playpause` and `previous track`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.** `appScript(app)` is exactly:
  ```applescript
  tell application "<app>"
    try
      if player state is stopped then return "stopped"
      return (player state as text) & tab & (artist of current track) & tab & (name of current track)
    on error
      return "stopped"
    end try
  end tell
  ```
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: macOS AppleScript sound backend`.

### Task 17: MascotAmp panel and sound wiring

**Files:**
- Create: `hooks/views/mascotAmp.tsx`
- Modify: `hooks/art/instruments.ts`, `hooks/animator.ts`, `hooks/register.tsx`, `hooks/views/studio.tsx`, `types/index.d.ts`, `tests/harness.ts`
- Test: `tests/amp-art.test.ts`, `tests/sound-wiring.test.ts`

**Interfaces:**
- Consumes: Tasks 13–16; `DJ` (Task 5); `sanitizeForRaster` and `textWords` (Task 2).
- Produces:
  - **Art:**
    - `lcdCells(text: string, cols: number, offset: number): string`, green `0x00FF00` on black.
    - `visualizerCells(heights: readonly number[]): string`, using glyphs `▁▂▃▄▅▆▇`.
    - `nextHeights(prev: readonly number[], playing: boolean, rand: () => number): number[]`, 16 values from 0 to 6.
    - `djCells(mode: 'dance'|'sway'|'doze', tick: number): string`
  - **Animator:** `AnimModel.amp = { lcdCols: number; marquee: string; mode: 'dance'|'sway'|'doze'; heights: number[] }`.
  - **Contract keys:** `sound: SoundStatus` and `soundFrames: number[]`.
  - `StudioActions` gains `sound(a: SoundAction): void` and `retrySound(): void`.
  - **Buttons:** `prev` (hotkey `b`, label `◀◀`), `play` (hotkey `p`, label `❚❚` while playing, else `▶`), `next` (hotkey `n`, label `▶▶`), `retry` (hotkey `r`, label `r: retry`).

- [ ] **Step 1: Write the failing art tests:**
  - `lcdCells('*** 日本語 🎵 ***', 20, 0)` decodes to 20 cells, all valid width-1 code points (Review Focus 1). Offsets wrap around the marquee.
  - `nextHeights(prev, false, …)` is all zeros.
  - With `playing`, each value changes by at most 2 per step and stays within 0–6.
  - `djCells('dance', t)` is 10×5 cells, and successive ticks differ.

- [ ] **Step 2: Write the failing wiring tests.** The harness `os: 'linux'` answers `process.run` for `uname` and `playerctl --version`, and `spawn` yields the playerctl lines:
  - **Playing:** after `startSession` and a spawned `Playing\tspotify\tDaft Punk\tOne More Time`, mounting at 46×30 shows:
    - Text `Spotify`.
    - Rasters `lcd`, `viz` and `dj`.
    - Buttons `prev`, `play` and `next`.
  - **Sound layer:** a second, different track line adds a Sound-layer keyframe at the current frame. The timeline's Sound row shows `●` there.
  - **Controls:** pressing `next` records run argv `['playerctl','next']`. A control exit code 1 toasts `MascotAmp couldn't reach Spotify`.
  - **Missing playerctl:** shows `Install playerctl to connect music`.
  - **Sound off:** `{ options: { sound: false } }` → no `process.spawn` or `process.run` recorded, and no `MascotAmp` section.
  - **Stopped:** with `os: 'windows'` and a spawn that exits 5 times, advancing the clock through the backoffs shows `r: retry`. Pressing it spawns again.

- [ ] **Step 3: Run them and confirm they fail.**
- [ ] **Step 4: Implement.**
  - **Starting sound:** `session.start` (when `options.sound !== false`) detects the OS with `$.env.get('OS')` and `$.process.run(['uname','-s'])`, picks the backend, and calls `watch` with a `SoundHost` built from `$.process.run`, `$.process.spawn`, `$.clock.every`, `$.clock.after` and a module-level `now` value updated each tick from `$.clock.now()`.
  - **Status updates:** `onStatus` writes `sound` only when it changed. A changed title or artist appends the current frame to `soundFrames`, capped at 200.
  - **Panel copy:** the marquee is `*** <title> - <artist> ***`, advanced one cell every 2 ticks. The `unavailable` and `stopped` texts are exactly as in spec §9.
  - **One-line mode:** `♪ <title> — <artist> [◀◀][❚❚][▶▶]`.
- [ ] **Step 5: Run them and confirm they pass. Validate.** Do a live check on Windows with Spotify or a browser playing.
- [ ] **Step 6: Commit** `feat: MascotAmp panel with Windows, macOS and Linux backends`.

---

## Milestone 4 — Extras

### Task 18: Error dialog and "Needs you"

**Files:**
- Create: `hooks/views/dialogs.tsx`
- Modify: `hooks/alerts.ts`, `hooks/register.tsx`, `hooks/views/studio.tsx`
- Test: `tests/dialogs.test.ts`

**Interfaces:**
- Consumes: the `dialog` key (Task 12); `statusLine` (Task 10); `targetOf` and `truncateMiddle` (Task 4).
- Produces:
  - `needsYouText(tool: string, target: string): string` → `MascotProgramming: hey! i need ur OK to run <tool>: <target>`
  - `QUESTION_TEXT = 'MascotProgramming: hey! i have a question for you'`
  - `dialogView(els, dialog: Dialog, cols: number, onOk: () => void)`, an absolute `Box` keyed `dialog` over the Stage, with an OK Button keyed `ok`.
  - `StudioActions.dismissDialog()`

- [ ] **Step 1: Write the failing tests:**
  - **Error dialog appears:**
    - A tool call answered `{ text: 'ENOENT: no such file\n at x', isError: true }` gives pose `facepalm`.
    - The dialog Box shows Texts `Mascot Programming`, `✖` and `Read failed: ENOENT: no such file`.
  - **Error dialog closes:** by pressing `ok`, by starting the next tool call, or after `clock.advance(8000)`.
  - **Permission request:**
    - `$.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } })` resolves with exactly what the test's bottom hook answered. The plugin decides nothing.
    - It sets pose `wave`, shows Text `MascotProgramming: hey! i need ur OK to run Bash: npm test`, and makes the last status `'ᓚᘏᗢ Mascot is waiting on you'`.
  - **Clears:** on the next `tool.call` settling, on `turn.complete` and on `prompt.submit`. After clearing, the status falls back to the usage warning or `undefined`.
  - **Notification:** `$.classic.Notification({ message: 'x', notification_type: 'permission_prompt' })` behaves the same.
  - **AskUserQuestion:** a `tool.call` of `AskUserQuestion` whose bottom hook is still pending (a promise resolved later by the test) shows `QUESTION_TEXT`. Settling it clears the dialog.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - Auto-close uses `$.clock.after(8000, …)`. It clears only if `dialog.at` still matches.
  - Every new or cleared dialog recomputes the status line, as in Task 12.
- [ ] **Step 4: Run it and confirm it passes. Validate.**
- [ ] **Step 5: Commit** `feat: error dialog and needs-you alert`.

### Task 19: Screensaver

**Files:**
- Create: `hooks/art/screensavers.ts`
- Modify: `hooks/animator.ts`, `hooks/register.tsx`, `types/index.d.ts`
- Test: `tests/screensaver.test.ts`

**Interfaces:**
- Consumes: Task 2's pixel helpers; `idleSince` (Task 7).
- Produces:
  - `type ScreensaverKind = 'pipes'|'starfield'|'flying-cats'`
  - `screensaverKindAt(idleMs: number): ScreensaverKind`, rotating every 60000 ms in the order pipes, starfield, flying cats.
  - `screensaverCells(kind: ScreensaverKind, cols: number, rows: number, tick: number, seed: number): string`
  - Contract key `screensaver: boolean`.
  - `AnimModel.stage.screensaver` becomes `ScreensaverKind | null`.

- [ ] **Step 1: Write the failing tests:**
  - **Determinism:** each kind returns `cols × rows` cells, and the same `(tick, seed)` gives identical output.
  - **Pipes grow:** pipes at tick 50 have more non-black cells than at tick 5.
  - **Rotation:** `screensaverKindAt(0)` is `pipes`, `61000` is `starfield`, `121000` is `flying-cats`, and `181000` is `pipes` again.
  - **Wiring:** with `screensaverMinutes: 1`, after `turn.complete` and `clock.advance(61500)`, the Stage raster in Scene 1 shows screensaver cells. `turn.start` turns it off.
  - **Disabled:** `screensaverMinutes: 0` never starts it.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - **Pipes:** reset every 60 s. Paths come from a seeded PRNG (mulberry32), each segment 2 px wide and shaded light on top, dark below.
  - **Starfield:** 40 stars projected from the center.
  - **Flying Cats:** 3 mini sprites with toast wings (`MINI.relaxed` plus 3×2 tan wings) drifting diagonally and wrapping.
  - **Wiring:** the ticker sets `screensaver: true` once `now - idleSince >= minutes*60000`. `turn.start`, `tool.call` and `prompt.submit` set it to `false`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: Commit** `feat: screensavers`.

### Task 20: Hit counter and holiday hats in the pane

**Files:**
- Modify: `hooks/register.tsx`, `types/index.d.ts`
- Test: `tests/visitors.test.ts`

**Interfaces:**
- Consumes: `hatFor` (Task 3); footer `visitors` (Task 8).
- Produces: contract key `visitors: number | null`. The store key is `visitors`.

- [ ] **Step 1: Write the failing tests:**
  - **Loads:** `mock.store(on, { visitors: 426 })`, then one tool call: the footer shows `visitor #000427` and the store holds 427.
  - **Empty store:** the counter starts at 0, and one call shows `visitor #000001`.
  - **Failed write:** a failing `$.store.set` (the test answers `{ deny }`) leaves the footer counting and is retried on the next call.
  - **Hat by date:** `mock.clock(on, { now: <Oct 5 local> })`, then compare the Stage raster cells to `stageCells` with hat `pumpkin`; with Jul 4, compare to `beanie`.

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
  - `session.start` loads the store into state.
  - Each `tool.call` pre-step increments the state, then calls `$.store.set` inside try/catch.
  - The render passes `hatFor(new Date(now))` into the stage model.
- [ ] **Step 4: Run it and confirm it passes. Validate.**
- [ ] **Step 5: Commit** `feat: lifetime hit counter and holiday hats`.

---

## Milestone 5 — Release

### Task 21: README, license and a full live pass

**Files:**
- Create: `README.md`, `LICENSE`, `docs/media/studio.gif`
- Test: none (docs and a manual pass)

- [ ] **Step 1: Write `LICENSE`.** Use MIT, with the year 2026 and the GitHub login as the holder.
- [ ] **Step 2: Write `README.md`.**
  - What it is, with `docs/media/studio.gif` embedded.
  - Install: the two commands from spec §13, with the real login.
  - Settings table (spec §3) and hotkeys.
  - Per-OS sound notes:
    - **Windows:** works out of the box.
    - **Linux:** `sudo apt install playerctl` (or the distro's package).
    - **macOS:** Music and Spotify are supported, and the first use asks for Automation permission.
  - "Tested on Windows; macOS/Linux testers welcome".
  - The naming and originality note.
  - Development: `claude plugin test plugins/mascot-studio`, `claude plugin validate plugins/mascot-studio`, `claude --plugin-dir plugins/mascot-studio`.
- [ ] **Step 3: Full live pass on Windows.** Sync to the mods folder, then:
  - **Startup:** start a fresh fullscreen session at 144+ columns. Success criterion 1: the pane docks by itself.
  - **Activity:** run a turn that reads, edits, runs Bash and fails a command. Every pose shows, the error dialog appears, and keyframes are inspectable.
  - **Usage:** Scene 2 figures match `/status`.
  - **Sound:** play music; the track appears within 2 s, and `b`/`p`/`n` work.
  - **Needs you:** trigger a permission prompt; the alert and status line show.
  - **Screensaver:** wait for it with `screensaverMinutes: 1`.
- [ ] **Step 4: GIF.** Ask the person to record a 10–20 s screen capture of the pane during a turn (for example with ScreenToGif) and save it as `docs/media/studio.gif`.
- [ ] **Step 5: Final checks.** Run `claude plugin test plugins/mascot-studio`, `claude plugin validate plugins/mascot-studio` and `npx -y -p typescript@5 tsc -p <synced folder>`. Expected: all pass with no errors.
- [ ] **Step 6: Commit** `docs: README, license and demo GIF`.

### Task 22: Publish to GitHub (requires confirmation)

**Files:** none

- [ ] **Step 1: Confirm.** Show the person:
  - The repo name `mascot-studio`.
  - That it will be public.
  - The commit list (`git log --oneline`).
  - The email on the commits.

  Wait for an explicit yes.
- [ ] **Step 2: Create the repo and push.**
  ```bash
  gh repo create mascot-studio --public --source . --push --description "A 2000s animation studio in your Claude Code terminal"
  ```
  Expected: the repo URL is printed and `git status` shows that `main` tracks `origin/main`.
- [ ] **Step 3: Verify the install.** In a fresh terminal:
  ```bash
  claude plugin marketplace add <login>/mascot-studio
  claude plugin install mascot-studio@mascot-studio
  ```
  Then start `claude` fullscreen at 144+ columns. Expected: the studio docks by itself.
