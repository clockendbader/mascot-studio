# Clawd Studio (v2) — design

Date: 2026-10-05
Status: draft for review
Builds on: `2026-10-05-mascot-studio-design.md` (v1). Anything this document does not change stays as v1 specifies, notably:
- Sound backends (§9).
- Usage data and thresholds (§7 data, thresholds, status-line warnings).
- Error handling (§11).
- Testing approach (§12).
- Distribution (§13).

Approved mockups: drawn in the brainstorming companion. Their generators live in `docs/superpowers/mockups/` and are the reference for the pixel art and colors:
- `poses.py`: Clawd and its animations.
- `styles.py` and `themes_extra.py`: the three themes.
- `layout.py`: the tab layout.

## 1. What changes and why

The person reviewed v1 live and asked for four changes:

| Change | v1 | v2 |
|---|---|---|
| Mascot | an original grey tabby cat | **Clawd**, Claude Code's own block critter, in a glossy 2010s edition |
| Look | 2002 Flash MX / Windows 2000, "too terminal" | three **2010s themes**: Windows 7 Aero, Mac OS X, Ubuntu Ambiance |
| Work poses | cat with props | Clawd **at a laptop** on a desk, the screen showing what it is doing |
| Navigation | hotkeys, a few small buttons | **clickable tabs** (Timeline · Usage · Music), clickable clips, buttons and status bar, hover highlights |

What goes away:
- The Flash menu bar and the frame ruler.
- The `Scene 1 | Scene 2` switcher and the automatic switch to the Task Manager after a turn. Usage becomes a tab you choose.
- The grey tabby, its hats and the mini mascot. The holiday hat idea moves to Clawd (§3).

## 2. Naming

- The window title reads **"Clawd Studio"**.
- The plugin, repo and install commands keep the name `mascot-studio`, so nothing published changes shape.
- Clawd is Anthropic's character. The README states plainly that this is an unofficial fan project, not affiliated with or endorsed by Anthropic.
- No Claude or Anthropic logo (the spark) appears anywhere.

## 3. Clawd and its Stage

**Clawd, glossy edition.**
- **Body:** a 16×10 px orange (`#D97757`) block with rounded corners.
- **Shading:** highlight `#EDA88C` on the top row and left edge, shade `#B5553A` on the bottom row and lower right edge, and a white specular pixel at the top left.
- **Eyes and legs:** two 2×3 eye slits (`#1F1410`) with white glints, and four 2×2 legs.

**The Stage.**
- **Size:** 40×24 px (40 columns × 12 rows). The theme's backdrop sits behind a desk (`#C8B39A` / `#9C8569`) at the bottom.
- **Clawd:** stands behind the desk.
- **The laptop:**
  - The screen is a 15×12 px bezel with a 13×10 interior, to Clawd's right.
  - The keyboard deck runs across the front at y 16–18.
  - Clawd's two outlined hands rest on the deck in front of it.
- **Narrow panes:** when the body is narrower than 42 columns, the scene is clipped on the right. The laptop's right edge goes first.

**Poses.** Each pose is an animation at 6 fps, looping. They are drawn exactly as the approved `poses.py` mockups, plus the four marked as new below.

| Trigger | Pose | Screen shows |
|---|---|---|
| Edit, Write, MultiEdit, NotebookEdit, any other tool | **coding**: hands tap in turn, key flashes, a slight bob, an occasional blink | syntax-colored code typed line by line, blinking cursor |
| `turn.start`, between tool calls | **thinking**: one hand rubs the top of its head, eyes up, a thought bubble fills with dots then shows "?" | the last code, cursor blinking |
| Read, Grep, Glob, LS, NotebookRead, ToolSearch | **reading**: hands rest, eyes on the screen | a white page scrolling, one line highlighted |
| Bash, PowerShell, BashOutput, KillShell, Monitor | **terminal**: types in bursts | a black terminal, prompt and output scrolling |
| WebFetch, WebSearch, browser tools | **browsing** (new) | a browser: blue title strip, a page with a spinning globe |
| Agent, Task | **helper** (new): a mini Clawd (8×5 px) pops up beside the laptop and waves | the last code |
| a tool fails | **oops**: facepalm, nervous shake, sweat drop | red with a white ✖ |
| waiting on the person | **waving** (new): Clawd turns to the viewer, both arms up, waving in turn | a chat bubble icon |
| `turn.complete` | **done**: hops with arms up, sparkles (about 1 s), then idle | green with a white ✓ |
| quiet for 60 s | **asleep** (new): eyes closed, slumped one pixel, "Zzz" rising | dark, the laptop's sleep light blinking |

Clawd keeps v1's state machine:
- The most recently started call sets the pose.
- When the last running call ends, it returns to thinking.
- After a turn ends: "done", then idle, then asleep after 60 s.

**Holiday hats.** These sit on Clawd's head row, with the dates from v1:
- October: pumpkin.
- December: Santa hat.
- January 1: party hat.
- February 14: heart.
- Any other day: no hat.

## 4. Themes

A `userConfig` field picks the theme:

| Field | Type | Options | Default |
|---|---|---|---|
| `theme` | string | `auto`, `windows7`, `macos`, `ubuntu` | `auto` |

- **Auto** follows the detected OS: Windows → `windows7`, macOS → `macos`, Linux or other → `ubuntu`.
- A change in `/config` reloads the module, and the pane redraws in the new theme.

A theme is pure data, one object per theme in `hooks/themes.ts`. It holds:
- **Colors:** chrome gradient, title text, tab bar, active tab, body, ink and soft ink, accent, hover, film strip film/holes/gap/playhead, status bar, music bar, dialog colors, and the usage bar colors for each level.
- **Window buttons:** where they sit and how they're drawn.
- **Stage backdrop:** a function from pixel to color.

| | Windows 7 | Mac OS X | Ubuntu |
|---|---|---|---|
| Title chrome | sky-blue glass gradient, title left, ─ □ and a red ✕ at the right | grey unified gradient, traffic lights at the left, title centered | dark `#3C3B37`, orange close and two grey dots at the left, title after them |
| Tabs | Ribbon row, active tab white | Aqua segmented control, active segment blue `#3D8BE8` | light tab row, active tab white |
| Stage backdrop | sky gradient `#3B7FC4` → `#A9D2F5` | linen `#3E4350` / `#383D49` | aubergine `#2C001E` → `#77216F` → orange `#E95420` |
| Music bar | dark glass `#16202B`, blue progress | iTunes LCD `#E6EBDA`, dark progress | dark `#3C3B37`, orange progress |
| Playhead / accent | red `#E81123` / blue `#3B7FC4` | yellow `#F5C400` / blue `#3D8BE8` | orange `#F07746` / `#E95420` |

## 5. Layout

The pane body, top to bottom. Every row is drawn with text cells and half-block rasters.

| Rows | Part | Notes |
|---|---|---|
| 2 | **Title chrome** | 1 raster row of gradient and rounded corners, then 1 text row with the title and window buttons. The buttons are decoration, except that clicking ✕ closes the pane. |
| 1 | **Tabs** | `Timeline · Usage · Music`; keys `1` `2` `3` |
| 12 | **Stage** | always visible |
| N | **Tab content** | N = body rows − 16, at least 4; at most 8 rows are used |
| 1 | **Status bar** | clickable: `Context 42%` and `5-hour 31%` open Usage, `♪ <title>` opens Music |

- Width: at least 32 columns, as in v1 ("Widen the pane to see the studio." below that).
- With fewer than 20 rows, the tab content shows its first lines only; the engine's pane scroll reaches the rest.

**Timeline tab:**
- A header line: `Steps this turn · 0:42` (the elapsed time while a turn runs) with the hit counter `visitor #000427` at the right. Parts are dropped from the right to fit.
- The **film strip**, 2 rows: film with sprocket holes. Each tool call is a 1-px clip colored by kind:

  | Kind | Color |
  |---|---|
  | read | blue `#4A90E2` |
  | edit | orange `#D97757` |
  | command | slate `#4B5563` |
  | web | green `#2EAD6B` |
  | subagent | purple `#8E5CD9` |
  | failed | red `#E5484D` |

  The playhead is a 1-px line in the theme's color. The strip scrolls to keep the playhead 8 clips from the right edge, as in v1.
- **Inspector:**
  - Clicking a clip pins it: `✎ Step 14 · Edit`, `✓ 120 ms` (or `✖` and the error line), and the target.
  - `◀ prev` / `next ▶` (keys `a` / `d`) walk the steps, and `Back to live` (key `l`) unpins.
- Unpinned, the same lines show the live tool, its target and the pose in words.

**Usage tab:**
- Three glossy bars (Context, 5-hour, Weekly), each with its percent and the reset time, colored by level as in v1 (80% amber, 95% red).
- A line with cost, turns and tool calls.
- The context history graph raster, one point per turn.
- `details ▸` (key `i`) swaps the graph for detail lines: tokens used of the window, both reset dates, and plan versus API key.
- On an API key the limit bars read "No plan limits (API key)".

**Music tab:**
- The DJ blob from v1, dancing, swaying or dozing with the playback state.
- Title, artist and app.
- A **progress raster** row: the bar and `m:ss` times as raster text cells, advanced by the ticker from the last reported position, so it moves without redraws.
- `⏮ ⏯ ⏭` buttons (keys `b` `p` `n`).
- The unavailable, stopped and retry states from v1.

**Progress data.** The backends add `position` and `duration` (seconds), where the player reports them. Without them, the bar and times are hidden.
- **Windows:** the helper adds `GetTimelineProperties()` `Position`/`EndTime` to each line.
- **Linux:** the format adds `{{position}}` and `{{mpris:length}}`.
- **macOS:** the script adds `player position` and `duration of current track`.

## 6. Clicking and hover

- **Buttons:**
  - Tabs, prev/next/live, details, the music buttons and the status-bar segments are `Button`s, plain where they sit in text.
  - The active tab is drawn as `Text` on the active background and is not pressable.
  - Inactive tabs are plain Buttons in a keyed `Box` whose `hover` sets the theme's hover background.
- **Film strip:** drawn by a `Client` surface module (`hooks/client/filmstrip.tsx`).
  - Its props are the clip colors, the playhead index and the window start.
  - It draws the strip as a `Raster` and posts `{ pick: n }` on a left-button `down`, hovering a clip outlines it.
  - The hooks module answers `ui.message` by pinning step `n`.
  - If the Client faults (`ui.fault`), the strip is drawn as a plain `Raster` again, and `◀ ▶` still reach every step.
- **Where clicks work:** in Claude Code's fullscreen layout. On the classic screen the terminal does not report clicks, and every action has a key.

## 7. Dialogs and screensavers

- **Dialogs:**
  - The error dialog and the "Needs you" window keep v1's triggers, texts and closes (§8).
  - They are drawn in the theme: Windows 7 glass title bar and white body, a Mac sheet dropping from the title chrome, an Ubuntu dark-titled dialog.
  - Clawd plays **oops** or **waving** behind them.
- **Screensavers:** the three remain. "Flying Cats" becomes **"Flying Clawds"** (mini Clawds with toast wings). They take over the Stage only. The tabs and status bar stay usable.

## 8. Architecture changes

New files:
- `hooks/themes.ts`: the three theme objects, `themeFor(setting, os)`.
- `hooks/art/clawd.ts`: Clawd, hats, the mini Clawd and the pose frames, ported from `poses.py`.
- `hooks/art/scene.ts`: desk, laptop, hands and the screen contents per pose.
- `hooks/views/chrome.tsx`: title, tabs and status bar.
- `hooks/views/timelineTab.tsx`, `hooks/views/usageTab.tsx`, `hooks/views/musicTab.tsx`.
- `hooks/client/filmstrip.tsx`: the Client module.

Changed files:
- `stage.ts`: draws the scene with the theme's backdrop.
- `layout.ts`: the rows of §5.
- `instruments.ts`: themed bars, graph and progress row.
- `dialogs.tsx`: themed.
- The sound backends: position and duration.
- `register.tsx`:
  - State `tab` replaces `scene`.
  - Detect the OS for the theme even when sound is off.
  - Wire `ui.message` and `ui.fault`.
  - Drop the Scene 2 switch.

Removed: `sprites.ts` (cat), `views/studio.tsx`'s menu bar and ruler, `views/taskManager.tsx` (its pieces move to the Usage tab).

Unchanged: activity, calendar, usage, alerts, supervisor, platform, the sound backends' watch logic, and the state flow.

## 9. Testing

Everything from v1 that still applies stays green. New coverage:
- **Themes:** for each theme × widths 32/46/60 × rows 20/24/30:
  - The tree validates.
  - The title, tabs, Stage raster and status bar are present.
  - `auto` maps to the right theme for each OS.
- **Poses:**
  - Every pose's frames are 40×24 cells-worth of valid colors.
  - Successive frames differ.
  - The tool → pose table matches §3.
- **Tabs and clicks:**
  - Pressing each tab, keys `1`–`3`, the status-bar segments, prev/next/live and details do what §5–6 say.
  - A `ui.message` `{ pick: n }` pins step `n`.
  - A `ui.fault` falls back to the plain strip.
- **Music progress:**
  - Parsers carry position and duration.
  - The progress row advances with the clock while playing and holds while paused.
- **Live:** the final pass is done in this session on Windows, with each theme set through `/config`.
