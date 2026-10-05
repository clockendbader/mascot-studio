import type { ProcResult, SoundHost } from '../hooks/sound/types'

/** Lets pending promise work run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

/**
 * A SoundHost with no engine behind it: spawned helpers print `lines` and exit
 * (after `runFor` milliseconds of fake time), runs answer `answer(argv)`, and
 * timers wait until the test fires them.
 */
export function fakeHost(lines: string[], answer: (argv: readonly string[]) => ProcResult | Promise<ProcResult> = () => ({ exitCode: 0, stdout: '', stderr: '' })) {
  const timers: { ms: number; fn: () => void; cancelled: boolean; repeat: boolean }[] = []
  const runs: string[][] = []
  const spawned: string[][] = []
  let clock = 0
  let runMs = 0
  const host: SoundHost = {
    run: async argv => {
      runs.push([...argv])
      return answer(argv)
    },
    spawn: argv => {
      spawned.push([...argv])
      return (async function* () {
        for (const text of lines) yield { stream: 'stdout' as const, text }
        clock += runMs
      })()
    },
    every: (ms, fn) => {
      const timer = { ms, fn, cancelled: false, repeat: true }
      timers.push(timer)
      return { cancel: () => void (timer.cancelled = true) }
    },
    after: (ms, fn) => {
      const timer = { ms, fn, cancelled: false, repeat: false }
      timers.push(timer)
      return { cancel: () => void (timer.cancelled = true) }
    },
    now: () => clock,
  }
  return {
    host,
    timers,
    runs,
    spawned,
    spawns: () => spawned.length,
    tick: (ms: number) => void (clock += ms),
    runFor: (ms: number) => void (runMs = ms),
    /** Fires the newest live timer once. */
    fire: async () => {
      const timer = [...timers].reverse().find(t => !t.cancelled)
      if (timer !== undefined) timer.fn()
      await flush()
    },
  }
}

/** An async stream a test feeds line by line; `end()` finishes it. */
export function channel<T>() {
  const queue: (T | null)[] = []
  let wake: (() => void) | undefined
  const push = (value: T | null) => {
    queue.push(value)
    wake?.()
  }
  async function* read(): AsyncGenerator<T> {
    for (;;) {
      while (queue.length === 0) await new Promise<void>(resolve => (wake = resolve))
      const value = queue.shift()
      if (value === null || value === undefined) return
      yield value
    }
  }
  return { push: (value: T) => push(value), end: () => push(null), read }
}
