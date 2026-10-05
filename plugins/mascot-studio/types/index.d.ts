export type Opener = 'startup' | 'person' | null
export type ThemeName = 'windows7' | 'macos' | 'ubuntu'
export type Hat = 'none' | 'pumpkin' | 'santa' | 'party' | 'heart'
export type Pose = 'thinking' | 'coding' | 'reading' | 'terminal' | 'browsing' | 'helper' | 'oops' | 'waving' | 'done' | 'idle' | 'asleep'
export type Keyframe = {
  id: string
  n: number
  tool: string
  target: string
  pose: Pose
  startedAt: number
  durationMs?: number
  isError?: boolean
  errorLine?: string
}
export type MiniMood = 'relaxed' | 'squint' | 'sweat' | 'flat' | 'asleep'
export type Activity = { pose: Pose; tool?: string; target?: string; since: number }
export type Tab = 'timeline' | 'usage' | 'music'
export type RateLimitView = { kind: string; percentUsed: number; resetsAt?: string }
export type UsageSnapshot = {
  contextPercent?: number
  contextTokens?: number
  rateLimits: RateLimitView[]
  costUsd?: number
  toolCalls: number
}
export type Track = { app: string; title: string; artist: string }
export type SoundStatus =
  | { kind: 'off' }
  | { kind: 'nothing' }
  | { kind: 'playing' | 'paused'; track: Track }
  | { kind: 'unavailable'; reason: 'missing-playerctl' | 'automation-denied' | 'unsupported-os' }
  | { kind: 'stopped' }
export type SoundAction = 'play-pause' | 'next' | 'previous'
export type Dialog =
  | { kind: 'error'; tool: string; line: string; at: number }
  | { kind: 'needs-you'; text: string; at: number }
  | null

declare module 'claude-code' {
  interface PluginState {
    'mascot-studio': {
      opener: Opener
      activity: Activity
      keyframes: Keyframe[]
      selectedFrame: number | null
      tab: Tab
      themeOverride: ThemeName | null
      turnStartedAt: number | null
      idleSince: number | null
      turns: number
      usage: UsageSnapshot
      contextHistory: number[]
      dialog: Dialog
      sound: SoundStatus
      soundFrames: number[]
      screensaver: boolean
      visitors: number | null
    }
  }
}
