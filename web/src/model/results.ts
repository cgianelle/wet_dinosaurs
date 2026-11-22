import type { Arrangement, SolveRequest, SolveResponse } from './contract'
import { currentFingerprint } from './request'
import type { Classroom } from './types'

/** The room as it was at Run, kept so results stay renderable after edits (AD-11). */
export type RoomSnapshot = Classroom

/** One successful Run, immutable and self-contained (AD-11). */
export interface RunResult {
  readonly fingerprint: string
  readonly request: SolveRequest
  readonly snapshot: RoomSnapshot
  readonly arrangements: SolveResponse['arrangements']
}

/** Out of date is derived on every render, never stored (AD-11). */
export const isOutOfDate = (result: RunResult, current: Classroom): boolean =>
  currentFingerprint(current) !== result.fingerprint

export const allRulesMet = (a: Arrangement): boolean => a.rulesMet === a.rulesTotal

/**
 * FR-37: when no option meets every rule, the option with the highest `rulesMet` (ties to the lower
 * rank). Returns null when some option meets every rule. The client compares; it counts nothing.
 */
export function fewestBrokenOption(arrangements: readonly Arrangement[]): Arrangement | null {
  if (arrangements.length === 0 || arrangements.some(allRulesMet)) return null
  return arrangements.reduce((best, a) => (a.rulesMet > best.rulesMet ? a : best))
}

/** Score for display: weighted100 / 100, two decimals, a real minus sign. Integer arithmetic only. */
export function formatScore(weighted100: number): string {
  const magnitude = Math.abs(weighted100)
  const whole = Math.trunc(magnitude / 100)
  const hundredths = String(magnitude % 100).padStart(2, '0')
  return `${weighted100 < 0 ? '−' : ''}${whole}.${hundredths}`
}
