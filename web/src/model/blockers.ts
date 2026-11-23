import { ruleErrors, type RuleProblem } from './rules'
import type { Classroom } from './types'

export type Blocker =
  | { readonly kind: 'noStudents' }
  | { readonly kind: 'countMismatch'; readonly students: number; readonly desks: number }
  | { readonly kind: 'ruleError'; readonly ruleId: string; readonly reason: RuleProblem }

/**
 * Why Run is unavailable, in display order; Run is enabled iff this is empty (FR-16, AD-10).
 * The front wall is always set, so no room is too small to run for a front-wall reason, and the
 * teacher's desk is never counted as a desk.
 */
export function runBlockers(c: Classroom): Blocker[] {
  const blockers: Blocker[] = []
  if (c.students.length === 0) blockers.push({ kind: 'noStudents' })
  if (c.students.length !== c.desks.length) {
    blockers.push({ kind: 'countMismatch', students: c.students.length, desks: c.desks.length })
  }
  for (const error of ruleErrors(c)) blockers.push({ kind: 'ruleError', ruleId: error.ruleId, reason: error.reason })
  return blockers
}
