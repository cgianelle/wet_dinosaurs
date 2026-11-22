import type { SolveRequest } from './contract'
import { frontEdgeOf } from './geometry'
import type { Classroom } from './types'

/**
 * The single translation from a Classroom to the wire request. Names and non-front markers never
 * leave the browser (AD-4). Null when the room has no valid Front marker.
 */
export function toRequest(c: Classroom): SolveRequest | null {
  const front = c.markers.find((m) => m.kind === 'front')
  const frontEdge = front ? frontEdgeOf(c.grid, front.cell) : null
  if (!frontEdge) return null
  return {
    grid: { columns: c.grid.columns, rows: c.grid.rows },
    frontEdge,
    desks: c.desks.map((d) => ({ id: d.id, column: d.cell.column, row: d.cell.row })),
    students: c.students.map((s) => ({ id: s.id })),
    rules: c.rules.map((r) =>
      r.type === 'notNear'
        ? { id: r.id, type: r.type, studentIds: [r.studentIds[0], r.studentIds[1]] }
        : { id: r.id, type: r.type, studentId: r.studentId },
    ),
  }
}

/** JSON with object keys sorted, so equal requests have equal strings. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

export const fingerprintOf = (request: SolveRequest): string => canonicalJson(request)

/** The fingerprint of a classroom's current inputs, or null when it cannot be run. */
export function currentFingerprint(c: Classroom): string | null {
  const request = toRequest(c)
  return request ? fingerprintOf(request) : null
}
