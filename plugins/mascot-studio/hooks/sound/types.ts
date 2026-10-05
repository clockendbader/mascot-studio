import type { SoundAction, SoundStatus, Track } from '../../types'

export type ProcResult = { exitCode: number; stdout: string; stderr: string }
export type Piece = { stream: 'stdout' | 'stderr'; text: string }
export type Timer = { cancel(): void }

/** What a sound backend may do on the host; register.tsx builds it from `$`. */
export type SoundHost = {
  run(argv: readonly string[], timeoutMs?: number): Promise<ProcResult>
  spawn(argv: readonly string[]): AsyncIterable<Piece>
  every(ms: number, fn: () => void): Timer
  after(ms: number, fn: () => void): Timer
  now(): number
}

export type SoundBackend = {
  /** Starts watching the system's now-playing; the function it returns stops it. */
  watch(host: SoundHost, onStatus: (s: SoundStatus) => void): () => void
  /** Sends a transport action, aimed at `track`'s app where the backend needs one. */
  control(host: SoundHost, action: SoundAction, track?: Track): Promise<boolean>
}
