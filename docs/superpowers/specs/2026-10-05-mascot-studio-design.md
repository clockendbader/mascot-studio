# Mascot Studio — design

Date: 2026-10-05
Status: draft for review

A Claude Code mod that shows a 2000s-era animation studio in a terminal pane while the agent works. Its mascot, **Mascot Programming** — a pixel-art grey tabby in a beanie — acts out what the agent is doing, checks Claude usage in a period Task Manager, and shares the pane with a DJ blob that dances to whatever music is playing.

## 1. Goals, non-goals, success

**Goals**

- A docked side pane in the Claude Code terminal, styled after a 2002 animation studio (timeline, layers, stage, properties).
- The mascot reacts to the agent's real activity: one pose per kind of work, one timeline keyframe per tool call.
- Claude usage (context, plan limits, cost) shown through a period Task Manager the mascot "uses".
- A music panel that shows and controls the system's now-playing track on Windows, macOS and Linux.
- Installable from GitHub; optionally opens itself in every session.

**Non-goals (v1)**

- Desktop app, VS Code or mobile surfaces. v1 is terminal only.
- Sound effects. The plugin API plays audio clips on macOS only, so they would be silent elsewhere.
- Real audio analysis. The visualizer is decorative.
- Anything on the later list (section 14).

**Success criteria**

1. Installing from the GitHub marketplace and starting Claude Code in a fullscreen terminal at 144+ columns shows the studio docked beside the transcript with no other steps.
2. Every tool call adds a keyframe and changes the mascot's pose within one animation frame of the call starting.
3. The Task Manager scene shows the same context %, plan-limit % and cost figures as Claude Code's own status line.
4. On each OS, a track playing in a supported player appears in the panel within 2 s, and the play/pause/next/previous controls work.
5. No failure inside the mod (a crashed sound helper, a missing figure, a refused draw) changes how any tool call, turn or prompt behaves.

## 2. Platforms and surfaces

- **Operating systems:** Windows 10+, macOS 13+, Linux with a desktop session. Everything except Sound is OS-independent because the engine does all drawing and timing.
- **OS detection:** `$.env.get("OS") === "Windows_NT"` means Windows. Otherwise `$.process.run(["uname", "-s"])`: `Darwin` means macOS, `Linux` means Linux, anything else leaves Sound unavailable.
- **Surface:** terminal only. The pane's art uses `Raster`, which only the terminal surface has. On any other surface, `/studio` answers "Mascot Studio runs in the terminal for now." and the pane is never opened.

## 3. Settings, startup and commands

Settings are declared as `userConfig` fields in `plugin.json`, so each is a row in `/config`:

| Field | Type | Default | Effect |
|---|---|---|---|
| `openOnStartup` | boolean | `true` | Open the studio when a session starts. |
| `sound` | boolean | `true` | Off: no helper process runs, no media is read, and the Sound panel is not drawn. |
| `screensaverMinutes` | number | `5` | Idle minutes before the screensaver; `0` disables it. |

**Startup.** On `session.start`, if `openOnStartup` is on and the session draws on the terminal, the mod opens the pane unasked. The engine docks an unasked pane from 144 columns (110 once the person has opened it themselves) and holds it undrawn below that. If the pane is placed inline instead of docked (the terminal's classic main screen), the mod closes it on its first draw and shows a one-time toast: "Mascot Studio: type /studio to open it." It never takes over the classic screen unasked.

**Command.** `/studio` opens the pane, or closes it if it is already open. Opened this way it seats at any width.

**Hotkeys** (while the pane holds the keyboard): `t` toggles Scene 1 / Scene 2, `l` returns the inspector to live, `b` / `p` / `n` are previous / play-pause / next, `r` retries a stopped sound helper. Esc returns focus to the prompt (engine behaviour).

## 4. Layout

The pane body is everything inside the engine's frame. The title is `Mascot Studio MX · <cwd folder name>.fla`.

Scene 1 (the studio), at 46 columns:

```
│ File  Edit  View  Insert  Modify  Control    │
│┄ Timeline ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│          1   5    10   15   20   25   30   35│
│ ✎ Cat    ●──●●─●───●─●●──●─●───●●─●█·········│
│ ♪ Sound  ●──────────────────●──────█·········│
│   Scene 1 · frame 27 · 0:42 · visitor #000427│
│┄ Stage ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│ (12-row pixel stage: grey work area, white   │
│  canvas, the mascot at 24×24 px)             │
│┄ Properties ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│ Tool    Edit            Pose  pen tablet     │
│ Target  hooks/studio.tsx                     │
│┄ MascotAmp ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
│   ▄██▄    ▌*** One More Time - Daft Punk *▐  │
│  ◖████◗   Spotify  ▂▅▇▃▆▂▇▅▃▆▂▅▇▃▆▂          │
│   ▀██▀    [ ◀◀ ]  [ ❚❚ ]  [ ▶▶ ]             │
```

- **Menu bar:** decorative, drawn dim.
- **Timeline:** described in section 6.
- **Stage:** one `Raster` the width of the body and 12 rows tall (24 px). The grey work area and white canvas are drawn in the raster's own colors, so they look the same in light and dark terminals. Scene 2 replaces the Stage contents (section 7).
- **Properties:** the live tool, its target and the pose, or the inspected keyframe (section 6).
- **MascotAmp:** section 9.

**Responsive rules.** Widths come from `e.props.bodyColumns`, never the viewport.

- Timeline frames shown = `bodyColumns − 10`.
- The Stage canvas shrinks toward the sprite's 24 columns, then the work area disappears.
- Targets are truncated in the middle (`hooks/…/studio.tsx`).
- Below 32 columns the body shows only "Widen the pane to see the studio."

Heights are taken from `e.viewport.rows`. The full layout needs about 27 rows (Scene 1) or 30 (Scene 2). When short, collapse in this order:

1. MascotAmp becomes one line: `♪ One More Time — Daft Punk [◀◀][❚❚][▶▶]`.
2. The menu bar is hidden.
3. Properties becomes one line.
4. Scene 2's Limits and Totals boxes fold into its status line.

The Stage always keeps its 12 rows.

## 5. The mascot

**Sprites.** All art is original pixel art stored as palette-indexed text grids in source.

- Mascot: 24×24 px, three layers per frame: body pose, hat, prop.
- Mini mascot (Task Manager graph): 8×8 px.
- DJ blob: 10×10 px, with headphones.
- Each pose has 2–4 frames.

**Rendering.** A half-block packer turns pixel grids into raster cells: `▀` with the top pixel as foreground and the bottom pixel as background, so each cell is 1×2 px.

**Animation.** One `$.clock.every(166)` ticker (~6 fps) advances every animation and repaints the mounted rasters with `$.ui.blit`, without a render pass. It skips when the pane is not mounted. A denied blit marks that raster unmounted until its next draw.

**Poses.** Tool names are compared as `String(e.tool)`.

| Trigger | Pose | Scene |
|---|---|---|
| `turn.start`; also after each tool call ends while the turn runs | thinking: chin-scratch, `?` bubble | 1 |
| Read, Grep, Glob, LS, NotebookRead, ToolSearch | magnifier sweep | 1 |
| Edit, Write, MultiEdit, NotebookEdit | pen tablet | 1 |
| Bash, PowerShell, BashOutput, KillShell, Monitor | keyboard | 1 |
| WebFetch, WebSearch, any tool whose name contains `browser` or `chrome` | tiny browser window, spinning globe | 1 |
| Agent, Task | whistles; a tiny helper cat runs in | 1 |
| any other tool | pen tablet | 1 |
| a tool call ends with `isError` | facepalm + error dialog (section 8) | 1 |
| waiting on the person (section 8) | waving + message window | 1 |
| `turn.complete` | "Export Movie" hop (~1.5 s), then Ctrl+Alt+Del | 1 → 2 |
| 60 s with no turn running | mini mascot falls asleep in front of Task Manager | 2 |
| `screensaverMinutes` idle | screensaver (section 8) | Stage |

When several calls overlap (parallel calls, subagents), the most recently started call sets the pose.

**Scene switching.** The scene changes automatically only at two moments: `turn.start` switches to Scene 1, and `turn.complete` switches to Scene 2 after the hop. Pressing `t` or the footer's scene switcher changes the scene by hand, and that choice holds until the next automatic switch.

**Hats by local date.**

| Dates | Hat |
|---|---|
| October | pumpkin |
| December | Santa hat |
| January 1 | party hat |
| February 14 | heart beanie |
| any other day | grey beanie |

## 6. Timeline and keyframe inspector

- **Frames.** Frame *n* is the session's *n*-th tool call. The **Cat** layer has a `●` keyframe at every frame. The **Sound** layer has a `●` at the frame current when the track changed.
- **Glyphs.** Frames between keyframes are `─`, the current frame is the red playhead `█`, and frames not yet reached are dim `·`.
- **Scrolling.** The strip scrolls so the playhead sits 8 frames from the right edge.
- **Footer line:** scene switcher (`Scene 1 | Scene 2`, pressable), frame number, turn elapsed time, and the hit counter `visitor #NNNNNN` (section 8), each dropped from the right when the width runs out.
- **History.** The last 200 keyframes are kept: `{ n, tool, target, pose, startedAt, durationMs?, isError?, errorLine? }`.
- **Targets.** A call's target is the first present of `file_path`, `path`, `notebook_path`, `pattern`, `url`, `query`, the first line of `command`, or `description`.
- **Inspector.** Each `●` is a `plain` one-glyph `Button`, so it can be clicked or reached with Tab. Selecting one pins Properties to that call: tool, target, ✓/✖, and duration. Clicking the playhead or pressing `l` returns to live.

## 7. Task Manager scene (usage)

Scene 2 replaces the Stage contents with a period "Task Manager" window on its Performance tab:

```
│ ▓ Task Manager                   _ □ × ▓     │
│  Applications   Processes  [Performance]     │
│ ┌ Context ┐┌ Context History ──────────────┐ │
│ │  ▄▄▄▄▄  ││ ┼───┼───┼───┼───┼───┼──·▄▄    │ │
│ │  █████  ││ │   │   │   │   │  ▄▀▀ ▐ᓚᘏᗢ   │ │
│ │  █████  ││ │   │   │   │ ▄▀▀▀   │        │ │
│ │  █████  ││ │   │  ▄▄▄▀▀▀│   │   │        │ │
│ │  42 %   ││ ▄▄▄▀▀───┼───┼───┼───┼───      │ │
│ └─────────┘└───────────────────────────────┘ │
│ ┌ Limits ──────────────┐┌ Totals ──────────┐ │
│ │ 5-hour ████░░░░░ 31% ││ Turns          12│ │
│ │ Weekly ██░░░░░░░ 18% ││ Tool calls     27│ │
│ │ resets 4:10 PM       ││ Est. cost   $0.84│ │
│ └──────────────────────┘└──────────────────┘ │
│ Tools: 27   Context: 42%   5-hour: 31%       │
```

**Data.** `$.session.usage()` is read on `session.start` and again on every `session.measure`. It supplies:

- `context.percent` and `context.tokens`.
- `rateLimits[]`: `five_hour` and `seven_day`, each with `percentUsed` and `resetsAt`.
- `cost.usd`.

The mod counts turns and tool calls itself. Figures the engine leaves out show as `—`.

**Context History.** One sample of `context.percent` per completed turn. The last *w* samples are kept, *w* being the graph's width in pixels. The graph is drawn green on black with a dark-green grid every 4 px and scrolls left like the original.

**Plan vs API key.**

- **On a plan** (`rateLimits` non-empty): the Limits box shows the 5-hour and weekly bars and the soonest reset time. The time is shown as `h:mm AM/PM` when the reset is today, `ddd h:mm AM/PM` otherwise. Cost is labelled "Est. cost".
- **On an API key** (`rateLimits` empty): the Limits box reads "No plan limits (API key)", and cost is labelled "Cost".

**Thresholds.** These apply to context and to each limit.

| Level | Meter color |
|---|---|
| under 80% | green |
| 80% or more | amber |
| 95% or more | red |

Crossing 80% also sets the status line (section 8 has priorities): `ᓚᘏᗢ context 84% · consider /compact` or `ᓚᘏᗢ 5-hour limit 82% · resets 4:10 PM`.

**Mini mascot.** It stands on the newest point of the history graph (drawn into that raster) and reacts to the highest figure shown:

| Highest figure | Reaction |
|---|---|
| under 50% | relaxed |
| 50–80% | magnifier squint |
| over 80% | sweating |
| 100% | flat on its back |

It falls asleep after 60 s of quiet.

**Look.** Navy title bar: a 1-row `Raster` whose cells carry the title text in white over a `#0A246A` → `#A6CAF0` gradient. Grey window `#D4D0C8`, green-on-black meters and graphs. The meters and graph are `Raster`s; labels and numbers are `Text`.

## 8. Extras

**Error dialog.** On a tool call that ends with `isError`, a period dialog is drawn over the Stage with an absolutely positioned `Box`:

- Title "Mascot Programming", a red ✖, the text `<Tool> failed:` and the error's first line truncated to fit, and `[ OK ]`.
- It closes on OK, when the next tool call starts, or after 8 s.
- The keyframe records `isError` and `errorLine`.

**"Needs you."**

- **Triggers:**
  - `classic.PermissionRequest` (a permission dialog is showing).
  - `classic.Notification` with `notification_type: "permission_prompt"`.
  - A `tool.call` of `AskUserQuestion` while its `next` is pending.
- **Effects:**
  - The mascot waves.
  - An instant-message window appears over the Stage: `MascotProgramming: hey! i need ur OK to run <Tool>: <target>`, or `…has a question for you` for AskUserQuestion.
  - The status line reads `ᓚᘏᗢ Mascot is waiting on you`.
- **Clears on:** the pending tool call settling, the next tool call starting, `turn.complete`, or `prompt.submit`.

**Status line priority.** The plugin owns one status line:

1. Needs-you.
2. The highest usage warning.
3. Nothing.

Each change re-evaluates it.

**Screensaver.** After `screensaverMinutes` with no turn running, the Stage raster shows a screensaver until any turn or tool event wakes it. Three original designs rotate every 60 s:

1. **Pipes:** growing 3D-shaded pipes.
2. **Starfield.**
3. **Flying Cats:** cats with toast wings drifting diagonally.

**Hit counter.** A lifetime count of tool calls across all sessions.

- Kept in `$.store` under `visitors`, incremented once per tool call.
- Mirrored into session state for drawing.
- Shown as a six-digit odometer `visitor #000427` in the timeline footer.

## 9. Sound (MascotAmp)

**Backend interface** (`sound/types.ts`):

```ts
type Track = { app: string; title: string; artist: string }
type SoundStatus =
  | { kind: 'off' }                          // sound setting off
  | { kind: 'nothing' }                      // no player has a session
  | { kind: 'playing' | 'paused'; track: Track }
  | { kind: 'unavailable'; reason: 'missing-playerctl' | 'automation-denied' | 'unsupported-os' }
  | { kind: 'stopped' }                      // helper failed repeatedly; `r` retries
type SoundAction = 'play-pause' | 'next' | 'previous'
type SoundBackend = {
  watch($, onStatus: (s: SoundStatus) => void): () => void   // returns stop
  control($, action: SoundAction, track?: Track): Promise<boolean>
}
```

**Windows: media session (SMTC).**

- **Watching:** a long-lived `$.process.spawn` of `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand <script>`, the script embedded in `windows.ts`.
  - The script loads `Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager` through WinRT.
  - Every 1000 ms it reads the current session's title, artist, playback status and `SourceAppUserModelId`.
  - It writes one JSON line only when something changed, or `{"none":true}` when there is no session.
- **Controls:** one-shot `$.process.run` of the same form calling `TryTogglePlayPauseAsync`, `TrySkipNextAsync` or `TrySkipPreviousAsync`.
- **App names:** `Spotify.exe` → Spotify, `chrome` → Chrome, `msedge` → Edge, `firefox` → Firefox. Any other id: strip the path and `.exe`.

**Linux: MPRIS through `playerctl`.**

- **Check:** `playerctl --version` first. If it fails to start, the status is `unavailable: missing-playerctl`, and the panel says "Install playerctl to connect music".
- **Watching:** `$.process.spawn` of `playerctl --follow metadata --format '{{status}}\t{{playerName}}\t{{artist}}\t{{title}}'`. One line per change; an empty line means no player.
- **Controls:** `playerctl play-pause | next | previous`.

**macOS: AppleScript for Music and Spotify.**

- **Polling:** every 2 s through `$.clock.every`.
  - `pgrep -x Music` and `pgrep -x Spotify` find which apps are running. This needs no permission, so the mod never launches an app and never compiles a script against an app that isn't installed.
  - For each running app, one `osascript -e` reads `player state`, `name of current track` and `artist of current track`.
- **Choosing a player:** a playing app wins; otherwise the most recently seen paused one; otherwise `nothing`.
- **Controls:** `tell application "<App>" to playpause | next track | previous track`, aimed at the app shown.
- **Automation denied:** if osascript fails with error `-1743`, the status is `unavailable: automation-denied`, and the panel says "Allow Automation for your terminal in System Settings › Privacy & Security › Automation".

**Shared behaviour.**

- Statuses are compared before writing state, so an unchanged track costs nothing.
- A change of `track.title`/`artist` adds a Sound-layer keyframe.
- The spawned helpers end with the module (reload or session end), as `$.process.spawn` guarantees.

**MascotAmp panel.**

- **DJ blob:** dances while playing, sways slowly while paused, and dozes with `nothing`.
- **LCD:** a 1-row `Raster` of text cells, green on black. It scrolls `*** <title> - <artist> ***` one cell every two ticks.
- **App and visualizer:** the app name and a 16-bar fake spectrum, a 1-row `Raster` of `▁▂▃▄▅▆▇` that random-walks while playing and lies flat otherwise.
- **Buttons:** `[ ◀◀ ]  [ ❚❚ / ▶ ]  [ ▶▶ ]` with hotkeys `b` / `p` / `n`.
- **Other statuses:** `unavailable` and `stopped` replace the LCD with a one-line explanation; `stopped` adds `[ r: retry ]`.

## 10. Architecture

```
plugins/mascot-studio/
├─ .claude-plugin/plugin.json      name, version, description, userConfig, "types"
├─ hooks/hooks.json                { "modules": ["./register.tsx"] }
├─ hooks/register.tsx              wiring only: events → state, commands, Pane render
├─ hooks/state.ts                  every $.state reference (atoms), one place
├─ hooks/activity.ts               pure: tool/turn events → pose, keyframe, target
├─ hooks/usage.ts                  pure: usage snapshot → meters, labels, thresholds
├─ hooks/calendar.ts               pure: date → hat; reset-time formatting
├─ hooks/animator.ts               the single ticker; per-raster frame functions; blit
├─ hooks/art/pixels.ts             pure: pixel grid ⇄ half-block raster cells (base64)
├─ hooks/art/sprites.ts            mascot poses, hats, props, mini mascot, DJ blob
├─ hooks/art/screensavers.ts       pipes, starfield, flying cats
├─ hooks/art/instruments.ts        meters, history graph, LCD, visualizer, title gradient
├─ hooks/ui/studio.tsx             layout + responsive collapse
├─ hooks/ui/timeline.tsx           layers, keyframe buttons, footer
├─ hooks/ui/taskManager.tsx        Scene 2
├─ hooks/ui/mascotAmp.tsx          sound panel
├─ hooks/ui/dialogs.tsx            error dialog, instant-message window
├─ hooks/sound/types.ts            interface above
├─ hooks/sound/platform.ts         OS detection → backend
├─ hooks/sound/windows.ts          SMTC helper (script embedded)
├─ hooks/sound/linux.ts            playerctl
├─ hooks/sound/macos.ts            pgrep + osascript
├─ types/index.d.ts                PluginState contract for every state key
└─ tests/*.test.ts                 see section 12
```

**State.** Everything a drawing reads lives in `$.state` under plugin `mascot-studio`. This keeps it across hot reloads and redraws exactly the readers. Keys:

| Key | Holds |
|---|---|
| `activity` | `{ pose, tool?, target?, since }` |
| `keyframes` | up to 200 keyframes |
| `soundFrames` | frame numbers where the track changed |
| `selectedFrame` | `number \| null` |
| `scene` | `1 \| 2` |
| `screensaver` | `boolean` |
| `usage` | the snapshot plus `turns` and `toolCalls` |
| `contextHistory` | `number[]` |
| `sound` | `SoundStatus` |
| `dialog` | `error` / `needs-you` / `null` |
| `turnStartedAt` | `number \| null` |
| `visitors` | `number` |

Writes go through `update()` from event hooks and press handlers, never from a render.

**Flow.**

- **Events:** engine events → `activity.ts` / `usage.ts` (pure) → `update()` state → the Pane re-renders its readers.
- **Animation:** the ticker → `animator.ts` → `$.ui.blit` on the rasters (stage, meters, graph, LCD, visualizer, DJ blob).
- **Sound:** sound backend → `onStatus` → `update()` `sound` (and `soundFrames`).

**Hooks registered.**

- `session.start`: OS detection, `/studio`, startup open, sound watch, ticker, usage read, visitors load.
- `command.run` for `studio`.
- `turn.start` and `turn.complete`.
- `tool.call`: observe; always returns `next(e)`'s result unchanged.
- `classic.PermissionRequest` and `classic.Notification`.
- `prompt.submit` and `session.measure`.
- `ui.render` for `{ component: 'Pane', requestId: 'mascot-studio' }`.
- `ui.press` for the Pane's buttons.

## 11. Error handling

- **Never break the session.**
  - Every observing hook does its own work inside try/catch and passes `next(e)`'s result through untouched.
  - Every registration has a `.catch` that answers `next(e)`.
  - The mod never denies or rewrites a tool call, prompt or turn.
- **Rendering.**
  - The Pane hook draws only elements and props from the terminal's element table. UI tests (section 12) mount it at the sizes in section 4.
  - A refused tree closes the pane (engine behaviour); the debug log has the reason.
- **Sound helper exits or fails to start:**
  - It restarts with backoff: 1, 2, 4, 8, 16 s, then 60 s.
  - After 5 failures within 2 minutes the status is `stopped` until `r` or `/studio` reopening.
  - A failed control shows the toast "MascotAmp couldn't reach <App>".
- **Missing figures.** Usage fields absent from `$.session.usage()` show as `—`. A failed usage read keeps the last snapshot.
- **Animation.** A denied blit stops that raster's animation until it is drawn again. The ticker never throws.
- **Storage.** A failed `$.store` read starts the counter at 0. A failed write is retried on the next tool call. Neither is shown to the person.

## 12. Testing

Tests run with `claude plugin test plugins/mascot-studio`, using `test` / `expect` / `mock` from `claude-code/testing`. The test's own hooks sit beneath the plugin and stand in for the engine, including `process.run` and `process.spawn`.

- **Pure units:**
  - `activity`: tool → pose table, target extraction, keyframe cap at 200.
  - `pixels`: packing and base64 round-trip.
  - Sprites: every frame's dimensions and palette indices are valid.
  - Timeline windowing.
  - `calendar`: hat by date, reset-time format.
  - `usage`: thresholds, plan vs API key labels.
  - Each sound parser, including empty, malformed and unicode lines.
- **Behaviour through the kit:**
  - A `tool.call` adds a keyframe and sets the pose, and its result passes through unchanged.
  - An `isError` result opens the error dialog.
  - `classic.PermissionRequest` sets needs-you and the status line; settling clears both.
  - `turn.complete` switches to Scene 2.
  - `session.measure` updates usage.
  - `openOnStartup: false` opens no pane.
  - `sound: false` starts no process.
  - Each OS (via mocked `OS` env and `uname`) issues the documented argv for watch and each control.
  - Backoff and the `stopped` status.
- **UI:**
  - Mount the Pane on the `terminal` surface at 32, 46 and 60 columns and at 20 and 30 rows. Each tree validates and shows the expected sections.
  - Pressing a keyframe pins Properties.
  - `t` switches scenes.
  - The sound buttons call the backend.
- **Static checks:** `claude plugin validate` and `tsc -p` are clean.
- **Live:** the mod is run in a real Claude Code session on Windows during development. macOS and Linux sound are covered by the mocked tests only; the README says so and asks for testers.

## 13. Distribution

```
mascot-studio/                       (GitHub repo; also a plugin marketplace)
├─ .claude-plugin/marketplace.json   one plugin entry, source "./plugins/mascot-studio"
├─ plugins/mascot-studio/            the plugin (section 10)
├─ docs/superpowers/specs/           this document
├─ README.md                         what it is, GIF, install, settings, per-OS sound notes
├─ LICENSE                           MIT
└─ .gitignore                        **/.claude-plugin/types/ (engine-generated), OS junk
```

**Install** (from the README):

```
claude plugin marketplace add <owner>/mascot-studio
claude plugin install mascot-studio@mascot-studio
```

`<owner>` is filled in from `gh api user` when publishing. Installed plugins load in every session, so with `openOnStartup` on, the studio appears every time Claude Code opens.

**Naming.** The mod imitates the era's look under its own names, with no third-party logos, icons or sounds:

| The mod's name | Instead of |
|---|---|
| "Mascot Studio MX" | Macromedia Flash |
| "Task Manager" | "Windows Task Manager" |
| a generic globe | the Internet Explorer logo |
| "MascotAmp" | Winamp |

All sprites are original.

**Publishing.** Pushing to GitHub happens only after the person confirms, and needs `gh auth login` first.

**Development.** The repo is developed on Windows. For live testing in a Claude Code session, the plugin folder is loaded either through the session's hot-reloading mods folder or with `claude --plugin-dir plugins/mascot-studio`; the implementation plan picks the mechanism after checking which works here.

## 14. Milestones and later list

Each milestone ends with the mod loading, validating and passing its tests.

1. **Studio core:**
   - Pane, startup and command, settings.
   - Timeline with keyframe inspector, Stage with all poses and hats, Properties.
   - Responsive layout.
2. **Task Manager scene:** usage data, meters, history graph with mini mascot, thresholds and the status line.
3. **Sound:**
   - The interface and the three OS backends.
   - The MascotAmp panel and the Sound layer keyframes.
4. **Extras:** error dialog, needs-you, screensaver, hit counter.
5. **Release:** README with GIF, LICENSE, marketplace manifest, publish (after confirmation).

**Later, each designed separately:**

- Turn replay ("Test Movie").
- The mascot browsing the archived 2000s web.
- Mood board (Openverse / Are.na).
- Desktop app surface.
- Sound effects, once the engine plays audio on every OS.
- An XP-style theme.
