// Wire types of POST /v1/solve (AD-5). The zod schemas in src/solver are checked against these.

export type SolveRule =
  | { id: string; type: 'front' | 'isle'; studentId: string }
  | { id: string; type: 'notNear'; studentIds: [string, string] }

export interface SolveRequest {
  grid: { columns: number; rows: number }
  frontEdge: 'top' | 'bottom' | 'left' | 'right'
  desks: { id: string; column: number; row: number }[]
  students: { id: string }[]
  rules: SolveRule[]
}

export type OutcomeResult = 'met' | 'neutral' | 'notMet'

export interface Outcome {
  ruleId: string
  result: OutcomeResult
  detail: { row?: number; rows?: number; distance?: number; column?: number; columns?: number }
}

export interface Arrangement {
  rank: number
  scores: { front: number; nearBy: number; isle: number; total: number; weighted100: number }
  rulesMet: number
  rulesTotal: number
  assignments: { studentId: string; deskId: string }[]
  outcomes: Outcome[]
}

export interface SolveResponse {
  arrangements: Arrangement[]
}

export const ERROR_CODES = [
  'malformed_request',
  'limit_exceeded',
  'count_mismatch',
  'no_students',
  'invalid_front_edge',
  'desks_overlap',
  'desk_out_of_grid',
  'duplicate_id',
  'unknown_student',
  'duplicate_rule',
  'self_pair',
  'busy',
  'timeout',
  'internal',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]
