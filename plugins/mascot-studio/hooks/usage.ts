import type { MiniMood, RateLimitView, UsageSnapshot } from '../types'
import { formatReset } from './calendar'

export const WARN_AT = 80
export const CRITICAL_AT = 95
const ASLEEP_AFTER_MS = 60_000
const MASCOT = 'ᓚᘏᗢ'

export type Level = 'ok' | 'warn' | 'critical'

export type RawUsage = {
  context: { tokens?: number; percent?: number }
  rateLimits: readonly RateLimitView[]
  cost?: { usd: number }
}

export function snapshotFrom(raw: RawUsage, toolCalls: number): UsageSnapshot {
  return {
    ...(raw.context.percent !== undefined ? { contextPercent: raw.context.percent } : {}),
    ...(raw.context.tokens !== undefined ? { contextTokens: raw.context.tokens } : {}),
    rateLimits: raw.rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, ...(resetsAt !== undefined ? { resetsAt } : {}) })),
    ...(raw.cost !== undefined ? { costUsd: raw.cost.usd } : {}),
    toolCalls,
  }
}

export function level(pct: number | undefined): Level {
  if (pct === undefined || pct < WARN_AT) return 'ok'
  return pct < CRITICAL_AT ? 'warn' : 'critical'
}

const limit = (s: UsageSnapshot, kind: string) => s.rateLimits.find(l => l.kind === kind)

export function highestPercent(s: UsageSnapshot): number | undefined {
  const figures = [s.contextPercent, ...s.rateLimits.map(l => l.percentUsed)].filter((n): n is number => n !== undefined)
  return figures.length === 0 ? undefined : Math.max(...figures)
}

export function costLabel(s: UsageSnapshot): 'Est. cost' | 'Cost' {
  return s.rateLimits.length > 0 ? 'Est. cost' : 'Cost'
}

/** The soonest reset still ahead, as `formatReset` writes it. */
function soonestReset(limits: readonly RateLimitView[], now: Date): string {
  const ahead = limits
    .map(l => l.resetsAt)
    .filter((iso): iso is string => iso !== undefined && formatReset(iso, now) !== '')
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return ahead[0] === undefined ? '' : formatReset(ahead[0], now)
}

export function limitsView(s: UsageSnapshot, now: Date): { fiveHour?: number; weekly?: number; reset: string; isApiKey: boolean } {
  const fiveHour = limit(s, 'five_hour')?.percentUsed
  const weekly = limit(s, 'seven_day')?.percentUsed
  return {
    ...(fiveHour !== undefined ? { fiveHour } : {}),
    ...(weekly !== undefined ? { weekly } : {}),
    reset: soonestReset([limit(s, 'five_hour'), limit(s, 'seven_day')].filter((l): l is RateLimitView => l !== undefined), now),
    isApiKey: s.rateLimits.length === 0,
  }
}

const LIMIT_NAMES: Readonly<Record<string, string>> = { five_hour: '5-hour limit', seven_day: 'weekly limit' }

/** The status-line warning for the highest figure at 80% or more. */
export function usageWarning(s: UsageSnapshot, now: Date): string | undefined {
  const candidates: { pct: number; text: string }[] = []
  if (s.contextPercent !== undefined) candidates.push({ pct: s.contextPercent, text: `context ${s.contextPercent}% · consider /compact` })
  for (const l of s.rateLimits) {
    const name = LIMIT_NAMES[l.kind] ?? `${l.kind.replace(/_/g, ' ')} limit`
    const reset = formatReset(l.resetsAt, now)
    candidates.push({ pct: l.percentUsed, text: `${name} ${l.percentUsed}%${reset === '' ? '' : ` · resets ${reset}`}` })
  }
  const top = candidates.filter(c => c.pct >= WARN_AT).sort((a, b) => b.pct - a.pct)[0]
  return top === undefined ? undefined : `${MASCOT} ${top.text}`
}

export function miniMood(highest: number | undefined, quietMs: number): MiniMood {
  if (quietMs >= ASLEEP_AFTER_MS) return 'asleep'
  if (highest === undefined || highest < 50) return 'relaxed'
  if (highest <= WARN_AT) return 'squint'
  return highest >= 100 ? 'flat' : 'sweat'
}

export function pushHistory(list: readonly number[], pct: number | undefined, max: number): number[] {
  return pct === undefined ? [...list] : [...list, pct].slice(-max)
}
