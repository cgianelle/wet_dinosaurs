// The Classroom Planner's domain types. Everything here is plain JSON-serializable data (AD-9).

export interface Cell {
  readonly column: number
  readonly row: number
}

export interface Grid {
  readonly columns: number
  readonly rows: number
}

export type Edge = 'top' | 'bottom' | 'left' | 'right'

export const MARKER_KINDS = ['front', 'back', 'side', 'door', 'teacherDesk'] as const
export type MarkerKind = (typeof MARKER_KINDS)[number]

export interface Desk {
  readonly id: string
  readonly cell: Cell
}

export interface Marker {
  readonly id: string
  readonly kind: MarkerKind
  readonly cell: Cell
}

export interface Student {
  readonly id: string
  readonly name: string
}

export interface FrontRule {
  readonly id: string
  readonly type: 'front'
  readonly studentId: string
}

export interface IsleRule {
  readonly id: string
  readonly type: 'isle'
  readonly studentId: string
}

export interface NotNearRule {
  readonly id: string
  readonly type: 'notNear'
  readonly studentIds: readonly [string, string]
}

export type Rule = FrontRule | IsleRule | NotNearRule
export type RuleType = Rule['type']

export interface Classroom {
  readonly grid: Grid
  readonly desks: readonly Desk[]
  readonly markers: readonly Marker[]
  readonly students: readonly Student[]
  readonly rules: readonly Rule[]
}
