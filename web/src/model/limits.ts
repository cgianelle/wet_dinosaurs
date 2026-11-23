// One place for every limit the client enforces. The service holds the same numbers
// (solver/limits.go); a fixture test asserts they agree (AD-5).
export const MAX_COLUMNS = 15
export const MAX_ROWS = 15
export const MAX_DESKS = 50
export const MAX_STUDENTS = 50
export const MAX_NAME_LENGTH = 40
export const DEFAULT_GRID = { columns: 8, rows: 6 } as const
export const MAX_UNDO_STEPS = 100

export const MAX_DOORS = 3
export const MAX_TEACHER_DESKS = 1

/** The `field` values a `limit_exceeded` error can carry. */
export type LimitField = 'grid.columns' | 'grid.rows' | 'desks' | 'students'

const LIMIT_MESSAGES: Readonly<Record<LimitField, string>> = {
  'grid.columns': `Rooms can be up to ${MAX_COLUMNS} columns wide.`,
  'grid.rows': `Rooms can be up to ${MAX_ROWS} rows tall.`,
  desks: `Room is full (${MAX_DESKS} desks).`,
  students: `You've reached the ${MAX_STUDENTS}-student limit. Remove a student to add another.`,
}

/** Used for the client's own refusals and for any server `limit_exceeded`, so wording is identical. */
export function limitMessage(field: LimitField): string {
  return LIMIT_MESSAGES[field]
}

export function isLimitField(field: string | undefined): field is LimitField {
  return field === 'grid.columns' || field === 'grid.rows' || field === 'desks' || field === 'students'
}
