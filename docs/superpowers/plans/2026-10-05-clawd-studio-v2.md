# Clawd Studio v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Mascot Studio v1 into Clawd Studio v2: glossy Clawd at a laptop, three 2010s themes (Windows 7, Mac OS X, Ubuntu, plus Auto), a clickable tabbed layout. Then check it on all three OSes, make a demo GIF and README, run a security review, and publish to GitHub.

**Architecture:** Same plugin and `$` rule as v1. Everything that draws stays pure, and `register.tsx` makes every engine call. New pure modules:
- `themes.ts`: theme data.
- `art/clawd.ts` and `art/scene.ts`: the mascot and the laptop scene.
- The tab views.

Two `Client` surface modules carry every colored, clickable control:
- `client/row.tsx`: a generic row of colored, hoverable, clickable segments.
- `client/filmstrip.tsx`: the clickable film strip, drawn with `▀` half-block text.

**Tech Stack:**
- The v1 stack.
- `Client` surface modules.
- GitHub Actions on windows-latest, macos-latest and ubuntu-latest.
- esbuild (via npx) for the smoke bundle.
- Headless Edge plus ffmpeg for the GIF.

**Spec:** `docs/superpowers/specs/2026-10-05-clawd-studio-v2-design.md` (on top of v1's spec, same folder)

## Global Constraints

- All v1 Global Constraints still hold:
  - The `$` rule.
  - Atoms are declared in `register.tsx`.
  - The contract is types-only.
  - Raster text passes through `sanitizeForRaster`.
  - Observing hooks pass results through.
  - Commits use the noreply identity.
- **Readable on any terminal:** no plain `Text` or `Button` may rely on the terminal's default foreground over a themed background. Every themed `Text` sets `color`. Clickable themed controls are `Client` rows, which set both colors. No plain `Button` sits on a themed background.
- **Keyboard path:**
  - `/studio <action>` handles `timeline | usage | music | prev | next | live | details | play | back | skip | retry | theme <name>`.
  - A focused `client/row.tsx` also maps its segments' `key` letters.
- **Client modules** are referenced by literal paths written in `register.tsx` only:
  - `module="./client/row.tsx"`
  - `module="./client/filmstrip.tsx"`

  `register.tsx` builds the `<Client>` elements and hands them to the views as values.
- **Theme setting:** `userConfig.theme`, string, `options: ["auto","windows7","macos","ubuntu"]`, default `"auto"`. Auto maps windows → `windows7`, macos → `macos`, everything else → `ubuntu`.
- **Stage:** 40×24 px. Clawd's body is 16×10 at (4, 5), the screen interior is (23..35, 4..13), the desk sits at y 19–20 and the deck at y 16–18, all as in `docs/superpowers/mockups/poses.py`. Colors are exactly the mockups'.
- **Layout rows:** title chrome 2, tabs 1, Stage 12, tab content `max(4, min(8, rows − 16))`, status 1. Width at least 32.
- **Version:** `0.2.0` in `plugin.json` and `marketplace.json`.
- **Title and naming:**
  - The window title is "Clawd Studio"; plugin, repo and install names stay `mascot-studio`.
  - The README carries the unofficial and not-affiliated note.
  - No Anthropic or Claude logo anywhere.

## Review Focus

1. **A dark terminal with a light theme body.** Every label must stay legible. Test (Task 3): no `Text` in the mounted Pane tree lacks a `color` prop, and no plain `Button` remains.
2. **Clicks arriving for steps that scrolled out of the 200 kept, or bogus Client data.** Expected: they are ignored, never a crash or a wrong pin. Test (Task 4): `ui.message` with `{ pick: 999 }`, `{ pick: 'x' }` and `{}`.
3. **A track with no position or duration, or a duration of 0.** Expected: no progress bar and no `NaN`. Test (Task 6).
4. **The theme switched while a pose animates or a dialog is open.** Expected: the next draw uses the new theme, with no stale raster sizes. Test (Task 3): remount with another theme option, so blits match the mounted sizes.
5. **CI runners with no media session, no playerctl, or no Automation permission.** Expected: the smoke run reports `nothing`, `missing-playerctl` or `automation-denied` and passes. It never hangs. Test (Task 8): each smoke run has a 20 s cap and accepts exactly those outcomes.

---

### Task 1: Themes and the theme setting

**Files:**
- Create: `hooks/themes.ts`
- Modify: `.claude-plugin/plugin.json`, `types/index.d.ts`, `hooks/register.tsx`, `tests/harness.ts`
- Test: `tests/themes.test.ts`

**Interfaces:**
- Produces:
  - In the contract: `ThemeName = 'windows7'|'macos'|'ubuntu'`.
  - `Theme = { name: ThemeName; title: { top: string; bottom: string; text: string; buttons: 'right'|'traffic'|'ubuntu' }; tabs: { bar: string; active: string; activeText: string; text: string; hover: string }; body: string; ink: string; soft: string; accent: string; hover: string; film: { film: string; hole: string; gap: string; playhead: string }; status: { bg: string; text: string }; music: { bg: string; text: string; soft: string; progress: string; track: string }; dialog: { title: string; titleText: string; body: string; text: string }; levels: { ok: string; warn: string; critical: string }; backdrop(x: number, y: number): number }`. Colors are `#RRGGBB` strings; `backdrop` returns `0xRRGGBB` for the Stage.
  - `THEMES: Readonly<Record<ThemeName, Theme>>`
  - `themeFor(setting: string, os: Os): Theme`
  - `register.tsx` detects the OS in `session.start` whether or not sound is on, into a module variable `osName`.

- [ ] **Step 1: Write the failing tests:**
  - **`themeFor`:**
    - `('auto','windows')` → `windows7`.
    - `('auto','macos')` → `macos`.
    - `('auto','linux')` and `('auto','other')` → `ubuntu`.
    - `('macos','windows')` → `macos`.
    - A value outside the options → as `auto`.
  - **Backdrops:** the Windows 7 backdrop at (0,0) is `0x3B7FC4`. The Ubuntu backdrop at (0,0) is `0x2C001E` and is `0xE95420`-ish (red channel > 0xD0) toward (39,18). The Mac backdrop alternates `0x3E4350` and `0x383D49`.
  - **Colors:** every theme string matches `/^#[0-9A-F]{6}$/i`.
- [ ] **Step 2: Run and confirm they fail.** `claude plugin test plugins/mascot-studio`
- [ ] **Step 3: Implement.**
  - Values come from `docs/superpowers/mockups/styles.py` (`aero`, `aqua`) and `themes_extra.py` (`ubuntu`).
  - Add the `theme` userConfig field with `options`.
  - Harness: `BootOptions.os` already drives detection; also answer `uname` for `other`.
- [ ] **Step 4: Run, validate and type-check.** Expected: all pass. Type-check with `npx -y -p typescript@5 tsc -p .superpowers/sdd/<plan>/tsconfig.json`, recreated in the workspace as in v1.
- [ ] **Step 5: Commit** `feat: three 2010s themes and the theme setting`.

### Task 2: Clawd, the laptop scene and the Stage

**Files:**
- Create: `hooks/art/clawd.ts`, `hooks/art/scene.ts`
- Delete: `hooks/art/sprites.ts`, `tests/sprites.test.ts`
- Modify: `hooks/art/stage.ts`, `hooks/art/screensavers.ts` (Flying Clawds), `hooks/art/instruments.ts` (DJ blob moves here from sprites), `hooks/activity.ts`, `types/index.d.ts`, `hooks/animator.ts`, `hooks/calendar.ts` (`Hat` gains `'none'`, loses `'beanie'`)
- Test: `tests/clawd.test.ts`, `tests/stage.test.ts` (rewritten), `tests/activity.test.ts` (pose names)

**Interfaces:**
- **`Pose`** (contract) becomes `'thinking'|'coding'|'reading'|'terminal'|'browsing'|'helper'|'oops'|'waving'|'done'|'idle'|'asleep'`.
- **`poseForTool`** maps:
  - read tools → `reading`
  - edit tools and any other tool → `coding`
  - shell tools → `terminal`
  - web and browser tools → `browsing`
  - Agent and Task → `helper`
  - AskUserQuestion → `waving`
- **`art/scene.ts`:** `sceneFrame(pose: Pose, hat: Hat, tick: number): Grid`, 40×24, transparent where the backdrop shows. `POSE_FRAMES: Readonly<Record<Pose, number>>`:

  | Pose | Frames |
  |---|---|
  | coding | 8 |
  | thinking | 8 |
  | reading | 8 |
  | terminal | 8 |
  | browsing | 8 |
  | helper | 8 |
  | oops | 6 |
  | waving | 4 |
  | done | 6 |
  | idle | 8 |
  | asleep | 4 |

- **`art/clawd.ts`:** `drawClawd(g: Grid, x0: number, y0: number, o: { look?: [number, number]; blink?: boolean; arms?: 'none'|'scratch'|'facepalm'|'up'|'wave-left'|'wave-right'; hat?: Hat; slump?: boolean }): void`, `drawMiniClawd(g, x, y, frame)`, `drawHands(g, mode: 'type'|'rest', f)`, `CLAWD_PALETTE`.
- **`stage.ts`:** `stageCells(o: { cols: number; pose: Pose; hat: Hat; tick: number; backdrop: (x: number, y: number) => number }): string`, 12 rows. The scene is centered when `cols ≥ 42`, otherwise left-aligned at x=1 and clipped right.
- **`AnimModel.stage`:** `{ cols; pose; hat; theme: ThemeName; idleSince: number | null; screensaver: { since } | null }`. The animator draws `asleep` instead of `idle` once `now − idleSince ≥ 60000`.

- [ ] **Step 1: Write the failing tests:**
  - **Frames:** every pose has `POSE_FRAMES[pose]` frames of 40×24 pixels, with all colors in `CLAWD_PALETTE` or transparent, and frame 0 ≠ frame 1.
  - **Screen contents:**
    - `coding` frames have syntax colors (`0xC678DD` or `0x61AFEF`) inside the screen interior.
    - `reading` has `0xE8ECF1` page pixels.
    - `terminal` has `0x0B0D10`.
    - `browsing` has a blue title strip `0x3B7FC4` on the screen's first interior row.
    - `oops` has `0xD9534F`.
    - `done` has `0x4CAF50`.
    - `asleep` has an all-dark screen, `0x1E2433` or darker.
  - **Hats:** `sceneFrame('coding','pumpkin',0)` differs from `'none'` only in rows 0–6.
  - **`stageCells`:**
    - At 46 columns the leftmost column is backdrop.
    - At 34 columns the result decodes to 34×12 cells, and column 0 holds Clawd's arm, x=1 in the left-aligned scene.
  - **Animator:** `idle` with `idleSince: 0` at `now: 61000` draws the same cells as `asleep`.
  - **Activity:** `poseForTool` follows the mapping above.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Port `poses.py` exactly: Clawd, hands, desk, laptop, screens, thought bubble, sparkles, sweat drop.
  - **New poses:**
    - **browsing:** title strip `#3B7FC4` on rows 4–5 of the interior, white page `#FFFFFF`, and a 5×5 globe (`#3366CC` / `#66CC66`) whose land shifts each frame.
    - **helper:** a mini Clawd (8×5: body 6×3 plus legs, the same shading) at x 13–20, y 1–5 popping up 0, 1, 2, 2… px, with one waving arm.
    - **waving:** Clawd's eyes face front (look 0,0) with `arms: 'wave-left'` or `'wave-right'` alternating, both arms raised, and a chat-bubble icon (white bubble with three `#3A3A3A` dots) on the screen.
    - **idle:** hands rest, a blink every 8 frames, a dim code screen.
    - **asleep:** eyes closed, `slump`, "Zzz" (`#3A3A3A`) rising at x 20–23, a dark screen `#11151C` with a blinking 1 px `#4CAF50` sleep light at the deck's front.
  - **Hats:** pumpkin, santa, party and heart as 16-wide overlays on Clawd's top rows (y0−4..y0), colors as v1.
  - **Screensavers:** Flying Clawds use `drawMiniClawd` with toast wings.
  - Update every test that named old poses.
- [ ] **Step 4: Run, preview and commit.** Preview by writing a temporary test that dumps the frames, then use `docs/superpowers/mockups`-style rendering to a PNG and look at it. Commit `feat: glossy Clawd at the laptop with eleven poses`.

### Task 3: Chrome, layout, tabs and the clickable row Client

**Files:**
- Create: `hooks/client/row.tsx`, `hooks/views/chrome.tsx`
- Modify: `hooks/layout.ts`, `hooks/views/studio.tsx`, `hooks/register.tsx`, `types/index.d.ts` (`Tab`, state `tab`; `scene` removed), `tests/harness.ts`
- Delete: Scene-2 code paths, `views/timeline.tsx` (replaced in Task 4), `views/taskManager.tsx` (replaced in Task 5)
- Test: `tests/layout.test.ts` (rewritten), `tests/chrome.test.ts`, `tests/row-client.test.ts`, `tests/studio-ui.test.ts` (rewritten)

**Interfaces:**
- **`client/row.tsx`:** default export `Row(props: RowProps, surface)`, where `RowProps = { segments: { id: string; text: string; fg: string; bg: string; hoverBg?: string; bold?: boolean; key?: string }[]; fill: string }`.
  - It draws one row of colored `Text` segments, filled to the region width with `fill`.
  - On a left-button `down` over a segment that has a `hoverBg` (only those are clickable), it posts `{ click: id }`.
  - `move` sets the hovered segment, and it draws with `hoverBg`.
  - A focused row maps `onKey` `key` letters to `{ click: id }`.
- **`chrome.tsx`:**
  - `chromeRows(els, theme, cols, title, clientRow): RenderElement`: the 2 title rows. Raster row 0 is a gradient with rounded corners. Row 1 is a `Client` row: the title on the left (or centered for `macos`), window buttons per `theme.title.buttons`, and a clickable `✕` (`id: 'close'`).
  - `tabsRow(...)` and `statusRow(...)`: the tabs `Client` row (ids `tab:timeline|usage|music`, keys `1 2 3`) and the status `Client` row (ids `tab:usage` on the context and 5-hour parts, `tab:music` on the song).
- **`layout.ts`:** `layoutV2(cols: number, rows: number): { tooNarrow: boolean; content: number; stageCols: number }`.
- **`register.tsx`:**
  - Builds the `<Client>`s (key per row) and passes them in the view model.
  - `on('ui.message', { requestId: PANE })` routes `click` ids to actions.
  - `/studio <action>` routes the same actions.
  - `ui.fault` sets `clientFaulted` and the view falls back to plain colored `Text` rows.

- [ ] **Step 1: Write the failing tests:**
  - **`layoutV2`:**
    - `(46,24)` → content 8.
    - `(46,30)` → content 8.
    - `(46,20)` → content 4.
    - `(31,40)` → tooNarrow.
    - `(60,24).stageCols` → 58.
  - **Row Client:** mount a pane and `ui.pointer({ type:'down', x:<col of "Usage">, y:0, button:'left', in:'tabs' })`. The Usage tab becomes active, and the Usage text segment carries `theme.tabs.active`.
  - **Hover:** `ui.pointer({ type:'move', … })` over "Music" draws it with `theme.tabs.hover`. A keyed `in:'tabs'` `ui.key({ key:'3' })` after a click switches to Music.
  - **Commands:** `/studio usage` → Usage; `/studio theme macos` → answers "Theme set to Mac OS X (this session)" and redraws with the macos theme.
    - That's a session-only override held in state `themeOverride`. It persists nothing; the `/config` setting is the lasting choice.
  - **Legibility (Review Focus 1):** for each theme × (32×20, 46×24, 60×30):
    - The tree validates.
    - `findAll({ type:'Text' })` all have `props.color`.
    - `findAll({ type:'Button' })` is empty.
    - The title text "Clawd Studio" shows; for macos it is centered within ±1 column.
  - **Theme change (Review Focus 4):** mount with `options: { theme: 'windows7' }`, then a fresh test with `ubuntu`. Each Stage raster blit has the mounted size.
  - **Close:** clicking `✕` closes the pane (`rec.closed`).
  - **Fault fallback:** `$.ui.fault`, raised by the test with `{ phase:'draw', reason:'x', element:'tabs' }`, makes the next draw contain no `Client` and the tab labels as `Text`.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
  - Remove the Scene 2 automatic switch and the `t` key.
  - Keep v1's startup and inline-close behavior.
  - The body background is `theme.body` on the content Box.
- [ ] **Step 4: Run, validate, type-check and commit** `feat: themed chrome, clickable tabs and status bar`.

### Task 4: Timeline tab with the clickable film strip

**Files:**
- Create: `hooks/client/filmstrip.tsx`, `hooks/views/timelineTab.tsx`
- Modify: `hooks/art/instruments.ts` (`filmstripCells` fallback raster, `clipColor`), `hooks/register.tsx`
- Test: `tests/timeline-tab.test.ts`, `tests/filmstrip-client.test.ts`

**Interfaces:**
- `clipColor(frame: Keyframe): string`, using spec §5's colors.
- `client/filmstrip.tsx` takes props `{ clips: { n: number; color: string }[]; current: number; selected: number | null; film; hole; gap; playhead; hover: string }`.
  - It draws 2 rows of `▀` Text cells: row 0 is film with holes over clip tops, row 1 is clip bottoms over film.
  - One cell per clip, a gap cell between clips; the playhead cell is in the playhead color.
  - `down` over a clip posts `{ pick: n }`; `move` outlines the hovered clip (its cells use `hover` as the film color).
- `timelineTabView(els, vm, strip: RenderElement | null)` shows:
  - The header (`Steps this turn · 0:42` with `visitor #000427` at the right, parts dropped right-to-left to fit).
  - The strip (Client, or the fallback raster).
  - The inspector lines.
  - A controls `Client` row: `◀ prev` (a), `next ▶` (d), `Back to live` (l), with ids `prev|next|live`.
- Actions: `pick n` (n must be an integer present in `keyframes`), `prev`, `next`, `live`.

- [ ] **Step 1: Write the failing tests:**
  - **Clip colors:** after Read, Edit and a failed Bash call, the film-strip Client props hold `#4A90E2`, `#D97757` and `#E5484D` in order.
  - **Pick:** `ui.pointer` down over the second clip cell pins step 2: an inspector Text with `Step 2 · Edit` and `✓`.
  - **Step through:** `prev` and `next` walk, `live` unpins, `/studio prev` works.
  - **Bad picks (Review Focus 2):** `$.ui.message` with `{ pick: 999 }`, `{ pick: 'x' }` and `{}` changes nothing.
  - **Fallback:** after a fault on `filmstrip`, a `Raster` keyed `filmstrip` appears instead.
  - **Header:** at 32 columns the header drops the visitor part.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, validate, type-check and commit** `feat: timeline tab with a clickable film strip`.

### Task 5: Usage tab

**Files:**
- Create: `hooks/views/usageTab.tsx`
- Modify: `hooks/art/instruments.ts` (themed `historyCells` colors), `hooks/register.tsx`
- Delete: `tests/taskmgr.test.ts` (ported)
- Test: `tests/usage-tab.test.ts`

**Interfaces:**
- `usageTabView(els, vm: { cols; theme; usage: UsageSnapshot; turns; toolCalls; details: boolean; now: Date }, graph: RenderElement | null, controls: RenderElement)`.
- **Bars:** `Context`, `5-hour` and `Weekly`, each as `label`, then `█` cells in `theme.levels[level]` and `░` cells in `theme.soft`, then `NN%` and `↻ <reset>`.
- **Other lines:** `Est. cost $0.84 · 12 turns · 27 tools`; the graph raster (`ctx-graph`, `cols−4` × 2 rows); a controls row with `details ▸` / `◂ graph` (id `details`, key `i`).
- **Details mode:** `Context 84k of 200k tokens`, `5-hour resets 4:10 PM`, `Weekly resets Mon 9:00 AM`, `Plan: subscription` / `API key`.
- **API key:** "No plan limits (API key)" instead of the limit bars.

- [ ] **Step 1: Write the failing tests.** Port v1's taskmgr assertions to the Usage tab:
  - Figures, plan versus API key, `— %` when missing, the refused startup read, the 80% warnings on the status line.
  - Details toggle via click and `/studio details`.
  - Bar color at 85% is `theme.levels.warn`.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.** Delete `views/taskManager.tsx` and the `tm-title` and `ctx-meter` rasters.
- [ ] **Step 4: Run, validate, type-check and commit** `feat: usage tab`.

### Task 6: Music tab with progress

**Files:**
- Create: `hooks/views/musicTab.tsx`
- Modify: `hooks/sound/windows.ts`, `hooks/sound/linux.ts`, `hooks/sound/macos.ts`, `types/index.d.ts` (`Progress`; optional `progress` on the playing and paused statuses), `hooks/art/instruments.ts` (`progressCells`), `hooks/register.tsx`
- Delete: `hooks/views/mascotAmp.tsx` (its pieces move here)
- Test: `tests/music-tab.test.ts`, and additions to `tests/sound-*.test.ts`

**Interfaces:**
- `Progress = { position: number; duration: number }` in seconds.
- **Parsers** add `progress` when both numbers are finite and the duration is greater than 0:
  - **Windows:** JSON `position` and `duration`. The script adds `$tl = $s.GetTimelineProperties()`, then `position = $tl.Position.TotalSeconds` (plus the elapsed time since `$tl.LastUpdatedTime` while playing) and `duration = $tl.EndTime.TotalSeconds`. The dedupe key includes `LastUpdatedTime` but not the live position.
  - **Linux:** two more tab fields, `{{position}}` and `{{mpris:length}}`, in microseconds.
  - **macOS:** two more fields, `player position` and `duration of current track`. Spotify's duration is in ms, so divide by 1000.
- **`register.tsx`:** `applySound` strips `progress` before comparing and writing state, and keeps `{ ...progress, at: now }` in a module variable `soundProgress`.
- `progressCells(p: Progress & { at: number } | null, playing: boolean, now: number, cols: number, theme: Theme): string` is a 1-row raster: `m:ss` + bar + `m:ss`, with the position advancing while playing. When `p` is null it shows only a blank row of the track color.
- `musicTabView(els, vm, dj: RenderElement, progress: RenderElement | null, controls: RenderElement)` shows:
  - The DJ blob raster (`dj`, 10×5) at the left.
  - Title, artist and app in `theme.ink` / `theme.soft`.
  - Progress.
  - A controls `Client` row: `⏮` (b) `⏯` (p) `⏭` (n), ids `back|play|skip`, plus `retry` (r) when stopped.

- [ ] **Step 1: Write the failing tests:**
  - **Parsers:**
    - Windows `{"…","position":72.4,"duration":185}` → progress 72.4/185.
    - Linux `…\t72400000\t185000000` → 72.4/185.
    - macOS Spotify `playing\tA\tT\t72.4\t185000` → 72.4/185.
  - **Bad progress (Review Focus 3):** missing, `0`, `NaN` or `-1` give no `progress`, and `progressCells(null, …)` holds no digits.
  - **Progress row:** `progressCells({ position: 72, duration: 185, at: 0 }, true, 10000, 30, theme)` shows `1:22`; with `playing` false it shows `1:12`.
  - **Wiring:**
    - A Linux playing line shows the title and artist and a `progress` raster.
    - Clicking `skip` runs `playerctl next`.
    - `/studio play` runs `play-pause`.
    - A control exit 1 toasts `MascotAmp couldn't reach Spotify`, renamed to `Couldn't reach Spotify`.
    - `sound:false` shows "Music is off. Turn it on in /config." and runs nothing.
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.** Re-check the Windows helper live with music playing (as in v1 Task 14).
- [ ] **Step 4: Run, validate, type-check and commit** `feat: music tab with live progress`.

### Task 7: Themed dialogs, idle and asleep, done, hats, Flying Clawds

**Files:**
- Modify: `hooks/views/dialogs.tsx`, `hooks/register.tsx`, `hooks/art/screensavers.ts`
- Test: `tests/dialogs.test.ts` (updated), `tests/screensaver.test.ts` (updated), `tests/visitors.test.ts` (hats now on Clawd)

**Interfaces:**
- `dialogView(els, dialog, cols, theme, okRow: RenderElement)`.
  - Title row in `theme.dialog.title` / `titleText`, body `theme.dialog.body` / `text`.
  - OK is a `Client` row (id `ok`).
  - Placed absolutely over the Stage at `top: 3`.
  - Macos: a sheet at `top: 0` under the chrome.
- **Poses:**
  - `turn.complete` → `done`, then `idle` after 1000 ms. The animator turns `idle` into `asleep` after 60 s.
  - Needs-you → `waving`.
  - A failure → `oops`.

- [ ] **Step 1: Update the tests to the v2 names.** Add:
  - The dialog title Text carries `theme.dialog.titleText` for each theme.
  - Clicking `ok` closes the error dialog.
  - Asleep after 61 s of quiet, without a redraw (stage blits change).
- [ ] **Step 2: Run and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, validate, type-check and commit** `feat: themed dialogs and Clawd's idle, done and asleep`.

### Task 8: Cross-platform smoke checks and CI

**Files:**
- Create: `scripts/smoke.ts`, `.github/workflows/ci.yml`, `package.json` (scripts only, no dependencies)

**Interfaces:**
- `scripts/smoke.ts`, bundled with `npx -y esbuild scripts/smoke.ts --bundle --platform=node --format=esm --outfile=.smoke/smoke.mjs`:
  - It builds a real `SoundHost` from `node:child_process` (`execFile` with a timeout for `run`; `spawn` with line pieces for `spawn`), `setInterval`, `setTimeout` and `Date.now`.
  - It polyfills `Uint8Array.prototype.toBase64` from `Buffer`.
  - It detects the OS with `detectOs(process.env.OS, uname)` and runs that OS's backend `watch` for 12 s, logging each status as JSON.
  - It runs `control(host, 'play-pause', track)` only when `SMOKE_CONTROL=1`.
  - Exit 0 when every status is in the allowed set and no `stopped` came. The allowed set:
    - Windows: `nothing`, `playing`, `paused`.
    - Linux: `nothing`, `unavailable:missing-playerctl`, `playing`, `paused`.
    - macOS: `nothing`, `unavailable:automation-denied`, `playing`, `paused`.
  - It also exits 0 with "no status in 12 s" on Linux with playerctl and no player (playerctl prints nothing). Otherwise exit 1.
- `ci.yml`, on push and pull_request, matrix `[windows-latest, macos-latest, ubuntu-latest]`:
  - `actions/checkout@v4`, `actions/setup-node@v4` (node 22).
  - `npm i -g @anthropic-ai/claude-code@2.1.289`.
  - `claude plugin validate plugins/mascot-studio` and `claude plugin test plugins/mascot-studio` (env `DISABLE_AUTOUPDATER=1`).
  - The smoke bundle and run. On ubuntu, run it first without playerctl (expects `missing-playerctl`), then `sudo apt-get install -y playerctl` and run again.
  - On macos, also `osacompile -o /tmp/m.scpt -e "$(node .smoke/print-music-script.mjs)"` to prove the Music script compiles.
  - `permissions: contents: read`.

- [ ] **Step 1: Write the smoke script.** Run it locally on Windows. Expected: statuses only from the allowed set (live: the current Spotify or Chrome track) and exit 0. Then `SMOKE_CONTROL=` stays unset.
- [ ] **Step 2: Write `ci.yml` and `package.json`.** Scripts: `test`, `validate`, `smoke`.
- [ ] **Step 3: Commit** `ci: tests and real-backend smoke checks on Windows, macOS and Linux`.

### Task 9: Demo GIF and theme screenshots

**Files:**
- Create: `scripts/demo/demo.test.ts.txt` (copied in as a test only while recording), `scripts/demo/render.py`, `scripts/make-demo.sh`, `docs/media/demo.gif`, `docs/media/theme-windows7.png`, `docs/media/theme-macos.png`, `docs/media/theme-ubuntu.png`

**Interfaces:**
- **The demo test** walks scenes and prints one `FRAME <json>` line per frame: `{ caption, theme, tree, rasters: { [key]: cells } }`. `tree` is `ui.drawn()` with each Client's own `drawn({ in })` inlined; `rasters` are the latest blits after advancing 166 ms.
  - Each scene is a theme mounted at 46×24 with 8–12 frames:
    1. coding (Win7)
    2. reading
    3. terminal
    4. oops with the error dialog
    5. thinking
    6. done
    7. the Usage tab
    8. the Music tab, playing
    9. waving with the needs-you window
    10. Mac theme, coding
    11. Ubuntu theme, coding
    12. a clip picked in the Timeline
- **`render.py`** turns each frame into HTML:
  - Box → a flex `div` (width in `ch`, backgroundColor, absolute position).
  - Text → a `span` (color, background, bold).
  - Raster → an SVG of `▀` cells.
  - Client `Text` cells as Text.
  - A caption bar above the pane.

  It writes pages of 12 frames, screenshots them with headless Edge, crops the frames with ffmpeg, and assembles `demo.gif` at 6 fps with `palettegen` / `paletteuse`, under 6 MB.
- **`make-demo.sh`:** copies the test in, runs `claude plugin test`, removes it, then renders.

- [ ] **Step 1: Write the scripts and run them.** Look at the GIF's frames (Read the PNGs) and at the three theme PNGs.
- [ ] **Step 2: Commit** `docs: demo GIF and theme screenshots`.

### Task 10: README, license, manifests and version

**Files:**
- Modify: `README.md`, `.claude-plugin/marketplace.json`, `plugins/mascot-studio/.claude-plugin/plugin.json` (version `0.2.0`, description)
- Keep: `LICENSE` (MIT 2026 clockendbader)

**The README covers:**
- The demo GIF at the top.
- What it is: Clawd acting out Claude's work.
- The unofficial / not-affiliated note.
- Install (the two commands) and first run (fullscreen at 144+ columns docks it; `/studio` otherwise).
- The three themes with screenshots and how to choose one (`/config` → Theme, or `/studio theme <name>` for this session).
- What each tab shows, clicking and the `/studio` actions.
- Settings.
- Music per OS: Windows works out of the box, Linux needs `playerctl`, macOS asks for Automation for Music/Spotify.
- What CI checks on each OS.
- Development commands.
- License.

- [ ] **Step 1: Write the README.** Check every claim against the code.
- [ ] **Step 2: Commit** `docs: README for Clawd Studio v2`.

### Task 11: Security review

- [ ] **Step 1: Run the review.** Load the `security-review` skill and follow it without subagents. Review in particular:
  - Every `$.process` call: argv only, no shell, fixed scripts, and the AppleScript app allow-list.
  - Client `ui.message` data validation.
  - Raster text sanitizing.
  - `$.store` contents.
  - Paths.
  - The CI workflow: pinned major versions, `contents: read`, no secrets, no `pull_request_target`.
  - The smoke script.
  - That no personal data (the email, local paths) is in committed files.
- [ ] **Step 2: Fix findings.** Fix each finding with a failing test first where it is code. Record the result.
- [ ] **Step 3: Commit** `security: review fixes` (if any).

### Task 12: Final review, live check, publish and CI

- [ ] **Step 1: Review.** Self-review the whole branch against both specs (the person asked for no subagents). Make one fix pass with a test per fix.
- [ ] **Step 2: Headless live check on Windows.**
  ```bash
  claude -p "Read README.md and tell me its first heading" --plugin-dir plugins/mascot-studio --debug --debug-file .live/debug.log
  ```
  Expected: an answer. `debug.log` has no `mascot-studio:` hook failure or refused tree lines, and it shows the sound helper started.
- [ ] **Step 3: Sync the mods folder.** Run `scripts/sync-dev.sh` into this session's mods folder, so the person's session reloads v2 when this turn ends.
- [ ] **Step 4: Publish.** The person already authorized the push.
  ```bash
  git checkout main && git merge --ff-only feat/clawd-studio-v2
  gh repo create clockendbader/mascot-studio --public --source . --description "Clawd Studio: a 2010s animation studio in your Claude Code terminal (unofficial fan project)" --push
  ```
  Then push the feature branches too, for history.
- [ ] **Step 5: Watch CI.** `gh run watch` on the push. Fix any OS failure (test first), push, and repeat until all three OSes are green.
- [ ] **Step 6: Release.** Tag `v0.2.0`, push the tag, and `gh release create v0.2.0` with notes and the GIF.
- [ ] **Step 7: Clean up.** Stop the brainstorming companion server and delete the plan workspace.
