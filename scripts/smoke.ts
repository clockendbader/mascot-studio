// Real-backend smoke check: runs this OS's music backend against the real
// system for 12 seconds and checks every status it reports is one the
// Music tab knows how to show. Bundle and run:
//
//   npx -y esbuild@0.28.2 scripts/smoke.ts --bundle --platform=node --format=esm --outfile=.smoke/smoke.mjs
//   node .smoke/smoke.mjs
//
// SMOKE_EXPECT=<label>  also require one status with this label (e.g. unavailable:missing-playerctl)
// SMOKE_CONTROL=1       send play/pause to the player afterwards (never set in CI)

import { execFile, spawn } from 'node:child_process'

import { linuxBackend } from '../plugins/mascot-studio/hooks/sound/linux'
import { macosBackend } from '../plugins/mascot-studio/hooks/sound/macos'
import { detectOs } from '../plugins/mascot-studio/hooks/sound/platform'
import type { Os } from '../plugins/mascot-studio/hooks/sound/platform'
import type { Piece, ProcResult, SoundBackend, SoundHost } from '../plugins/mascot-studio/hooks/sound/types'
import { windowsBackend } from '../plugins/mascot-studio/hooks/sound/windows'
import type { SoundStatus } from '../plugins/mascot-studio/types'

const WATCH_MS = 12_000

// Node has no Uint8Array#toBase64 yet; the Claude Code engine does.
const proto = Uint8Array.prototype as Uint8Array & { toBase64?: () => string }
if (typeof proto.toBase64 !== 'function') {
  Object.defineProperty(Uint8Array.prototype, 'toBase64', {
    value(this: Uint8Array) {
      return Buffer.from(this.buffer, this.byteOffset, this.byteLength).toString('base64')
    },
  })
}

function run(argv: readonly string[], timeoutMs = 15_000): Promise<ProcResult> {
  const [cmd, ...args] = argv
  return new Promise((resolve, reject) => {
    execFile(cmd ?? '', args, { timeout: timeoutMs, windowsHide: true, encoding: 'utf8' }, (error, stdout, stderr) => {
      const code = (error as { code?: unknown } | null)?.code
      if (code === 'ENOENT') {
        reject(error)
        return
      }
      resolve({ exitCode: error === null ? 0 : typeof code === 'number' ? code : 1, stdout, stderr })
    })
  })
}

/** A child process as stdout/stderr pieces; `return()` kills it at once, even while waiting. */
function pieces(argv: readonly string[]): AsyncIterable<Piece> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<Piece> {
      const [cmd, ...args] = argv
      const child = spawn(cmd ?? '', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      const queue: Piece[] = []
      let isDone = false
      let waiting: ((result: IteratorResult<Piece>) => void) | null = null
      const push = (piece: Piece) => {
        const wake = waiting
        waiting = null
        if (wake !== null) wake({ value: piece, done: false })
        else queue.push(piece)
      }
      const end = () => {
        isDone = true
        const wake = waiting
        waiting = null
        wake?.({ value: undefined, done: true })
      }
      child.stdout.setEncoding('utf8').on('data', (text: string) => push({ stream: 'stdout', text }))
      child.stderr.setEncoding('utf8').on('data', (text: string) => {
        process.stderr.write(`[${cmd} stderr] ${text}`)
        push({ stream: 'stderr', text })
      })
      child.on('error', end)
      child.on('close', end)
      return {
        next: () => {
          const piece = queue.shift()
          if (piece !== undefined) return Promise.resolve({ value: piece, done: false })
          if (isDone) return Promise.resolve({ value: undefined, done: true })
          return new Promise(resolve => (waiting = resolve))
        },
        return: () => {
          child.kill()
          end()
          return Promise.resolve({ value: undefined, done: true })
        },
      }
    },
  }
}

const host: SoundHost = {
  run,
  spawn: pieces,
  every: (ms, fn) => {
    const id = setInterval(fn, ms)
    return { cancel: () => clearInterval(id) }
  },
  after: (ms, fn) => {
    const id = setTimeout(fn, ms)
    return { cancel: () => clearTimeout(id) }
  },
  now: () => Date.now(),
}

const BACKENDS: Readonly<Record<Os, SoundBackend | null>> = { windows: windowsBackend, macos: macosBackend, linux: linuxBackend, other: null }
const ALLOWED: Readonly<Record<Os, readonly string[]>> = {
  windows: ['nothing', 'playing', 'paused'],
  linux: ['nothing', 'unavailable:missing-playerctl', 'playing', 'paused'],
  macos: ['nothing', 'unavailable:automation-denied', 'playing', 'paused'],
  other: [],
}

const label = (s: SoundStatus) => (s.kind === 'unavailable' ? `unavailable:${s.reason}` : s.kind)
const fail = (why: string): never => {
  console.error(`smoke: FAIL: ${why}`)
  process.exit(1)
}

const os = await detectOs(process.env.OS, async () => (await run(['uname', '-s'])).stdout)
const backend = BACKENDS[os] ?? fail(`no music backend for this OS (${os})`)
console.log(`smoke: ${os} backend, watching for ${WATCH_MS / 1000} s`)

const seen: SoundStatus[] = []
const stop = backend.watch(host, status => {
  seen.push(status)
  console.log(`smoke: ${JSON.stringify(status)}`)
})
await new Promise(resolve => setTimeout(resolve, WATCH_MS))
stop()

if (process.env.SMOKE_CONTROL === '1') {
  const last = [...seen].reverse().find(s => s.kind === 'playing' || s.kind === 'paused')
  const track = last !== undefined && (last.kind === 'playing' || last.kind === 'paused') ? last.track : undefined
  console.log(`smoke: play/pause sent: ${await backend.control(host, 'play-pause', track)}`)
}

const labels = seen.map(label)
const unexpected = labels.filter(l => !ALLOWED[os].includes(l))
if (unexpected.length > 0) fail(`unexpected statuses: ${unexpected.join(', ')}`)
const expected = process.env.SMOKE_EXPECT
if (expected !== undefined && expected !== '' && !labels.includes(expected)) fail(`expected a ${expected} status, saw: ${labels.join(', ') || 'none'}`)
if (labels.length === 0) {
  // playerctl --follow prints nothing while no player is running
  if (os !== 'linux') fail('no status in 12 s')
  console.log('smoke: no status in 12 s (playerctl with no player running)')
}
console.log(`smoke: OK (${labels.join(', ') || 'quiet'})`)
process.exit(0)
