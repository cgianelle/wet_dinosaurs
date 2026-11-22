import { frontEdgeOf } from './geometry'
import { ruleErrors, type RuleProblem } from './rules'
import type { Classroom } from './types'

export type Blocker =
  | { readonly kind: 'noStudents' }
  | { readonly kind: 'countMismatch'; readonly students: number; readonly desks: number }
  | { readonly kind: 'noFrontMarker' }
  | { readonly kind: 'frontMarkerNotOnEdge' }
  | { readonly kind: 'ruleError'; readonly ruleId: string; readonly reason: RuleProblem }

/** Why Run is unavailable, in display order; Run is enabled iff this is empty (FR-16, AD-10). */
export function runBlockers(c: Classroom): Blocker[] {
  const blockers: Blocker[] = []
  if (c.students.length === 0) blockers.push({ kind: 'noStudents' })
  if (c.students.length !== c.desks.length) {
    blockers.push({ kind: 'countMismatch', students: c.students.length, desks: c.desks.length })
  }
  const front = c.markers.find((m) => m.kind === 'front')
  if (!front) blockers.push({ kind: 'noFrontMarker' })
  else if (!frontEdgeOf(c.grid, front.cell)) blockers.push({ kind: 'frontMarkerNotOnEdge' })
  for (const error of ruleErrors(c)) blockers.push({ kind: 'ruleError', ruleId: error.ruleId, reason: error.reason })
  return blockers
}
