import type { SolveRequest } from './contract'
import type { Classroom } from './types'

/**
 * The single translation from a Classroom to the wire request. Names, doors, the teacher's desk and
 * the back and side walls never leave the browser (AD-4, D-4).
 */
export function toRequest(c: Classroom): SolveRequest {
  return {
    grid: { columns: c.grid.columns, rows: c.grid.rows },
    frontEdge: c.frontWall,
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

const byId = <T extends { id: string }>(items: readonly T[]): T[] => [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

/** Canonical string of a request: sorted keys, and desks, students and rules sorted by id (AD-11). */
export const fingerprintOf = (request: SolveRequest): string =>
  canonicalJson({
    ...request,
    desks: byId(request.desks),
    students: byId(request.students),
    rules: byId(request.rules).map((r) => (r.type === 'notNear' ? { ...r, studentIds: [...r.studentIds].sort() } : r)),
  })

/** The fingerprint of a classroom's current inputs (AD-11). */
export const currentFingerprint = (c: Classroom): string => fingerprintOf(toRequest(c))
