import type { SoundStatus } from '../../types'
import type { Piece, SoundHost, Timer } from './types'

const DELAYS = [1000, 2000, 4000, 8000, 16000] as const
const SLOW_DELAY = 60_000
const STOP_AFTER = 5
const STOP_WINDOW_MS = 120_000
const HEALTHY_RUN_MS = 60_000

/** A helper line longer than this is dropped whole rather than held. */
const MAX_LINE = 64 * 1024

/** Splits streamed text into whole lines, holding a partial last line for the next piece. */
export class LineBuffer {
  private rest = ''
  /** Set while the rest of an over-long line is still arriving. */
  private isSkipping = false

  push(text: string): string[] {
    const lines = (this.rest + text).split('\n')
    this.rest = lines.pop() ?? ''
    const whole: string[] = []
    for (const line of lines) {
      if (this.isSkipping) {
        this.isSkipping = false
        continue
      }
      whole.push(line.replace(/\r$/, ''))
    }
    if (this.rest.length > MAX_LINE) {
      this.rest = ''
      this.isSkipping = true
    }
    return whole
  }
}

/** The wait before restarting after these failures, or 'stop' after five within two minutes. */
export function backoffDelay(failureTimes: readonly number[], now: number): number | 'stop' {
  const recent = failureTimes.filter(t => now - t < STOP_WINDOW_MS)
  if (recent.length >= STOP_AFTER) return 'stop'
  return DELAYS[failureTimes.length - 1] ?? SLOW_DELAY
}

/**
 * Keeps a line-printing helper running: every stdout line goes through `parse`,
 * an exit restarts it with backoff, and repeated quick exits report `stopped`.
 */
export function watchLines(
  host: SoundHost,
  argv: readonly string[],
  parse: (line: string) => SoundStatus | null,
  onStatus: (s: SoundStatus) => void,
): () => void {
  let isStopped = false
  let failures: number[] = []
  let iterator: AsyncIterator<Piece> | undefined
  let timer: Timer | undefined

  const run = async (): Promise<void> => {
    if (isStopped) return
    const startedAt = host.now()
    const buffer = new LineBuffer()
    try {
      iterator = host.spawn(argv)[Symbol.asyncIterator]()
      for (;;) {
        const next = await iterator.next()
        if (next.done === true || isStopped) break
        if (next.value.stream !== 'stdout') continue
        for (const line of buffer.push(next.value.text)) {
          const status = parse(line)
          if (status !== null) onStatus(status)
        }
      }
    } catch {
      // could not start, or died: counted below like any exit
    }
    iterator = undefined
    if (isStopped) return
    const endedAt = host.now()
    if (endedAt - startedAt >= HEALTHY_RUN_MS) failures = []
    failures.push(endedAt)
    const delay = backoffDelay(failures, endedAt)
    if (delay === 'stop') {
      onStatus({ kind: 'stopped' })
      return
    }
    timer = host.after(delay, () => {
      void run()
    })
  }

  void run()
  return () => {
    isStopped = true
    timer?.cancel()
    void iterator?.return?.()
  }
}
