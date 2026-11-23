// The Classroom Planner's domain types. Everything here is plain JSON-serializable data (AD-9).

export interface Cell {
  readonly column: number
  readonly row: number
}

export interface Grid {
  readonly columns: number
  readonly rows: number
}

/** One of the four wall bands around the grid. The front wall is the wire's `frontEdge`. */
export type Wall = 'top' | 'bottom' | 'left' | 'right'
export const WALLS: readonly Wall[] = ['top', 'bottom', 'left', 'right']

/** What a wall is called, derived from the front wall (never stored). */
export type WallRole = 'front' | 'back' | 'side'

export interface Desk {
  readonly id: string
  readonly cell: Cell
}

/** The teacher's desk: a student-less, uncounted, visual-only cell in the grid (FR-5). */
export interface TeacherDesk {
  readonly id: string
  readonly cell: Cell
}

/**
 * An opening in a wall band, aligned with one cell: `index` is the 0-based column for the top and
 * bottom walls and the 0-based row for the left and right walls. A door is never a grid cell.
 */
export interface Door {
  readonly id: string
  readonly wall: Wall
  readonly index: number
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
  /** Always set; defaults to top (FR-6). */
  readonly frontWall: Wall
  readonly desks: readonly Desk[]
  readonly teacherDesk: TeacherDesk | null
  readonly doors: readonly Door[]
  readonly students: readonly Student[]
  readonly rules: readonly Rule[]
}
