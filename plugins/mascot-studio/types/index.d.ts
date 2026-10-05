export type Opener = 'startup' | 'person' | null
export type Hat = 'beanie' | 'pumpkin' | 'santa' | 'party' | 'heart'
export type Pose = 'thinking' | 'magnify' | 'tablet' | 'keyboard' | 'browser' | 'helper' | 'facepalm' | 'wave' | 'hop' | 'asleep'
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
export type Scene = 1 | 2
export type RateLimitView = { kind: string; percentUsed: number; resetsAt?: string }
export type UsageSnapshot = {
  contextPercent?: number
  contextTokens?: number
  rateLimits: RateLimitView[]
  costUsd?: number
  toolCalls: number
}
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
      scene: Scene
      turnStartedAt: number | null
      idleSince: number | null
      turns: number
    }
  }
}
