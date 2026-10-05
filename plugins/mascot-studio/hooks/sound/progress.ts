// Where a track is, as a player reports it: kept only when both numbers make sense.

import type { Progress } from '../../types'

/** A position and a length in seconds, or undefined unless both are finite, the length is above 0 and the position is not negative. */
export function progressOf(position: number, duration: number): Progress | undefined {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0 || position < 0) return undefined
  return { position, duration }
}

/** A number field as text; blank or unreadable is NaN. */
export function numberIn(field: string | undefined): number {
  if (field === undefined || field.trim() === '') return Number.NaN
  return Number(field.trim().replace(',', '.'))
}
