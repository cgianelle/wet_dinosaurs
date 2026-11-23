import type { Cell, Classroom, Door, Grid, Wall, WallRole } from './types'

export const sameCell = (a: Cell, b: Cell): boolean => a.column === b.column && a.row === b.row

export const inGrid = (grid: Grid, cell: Cell): boolean =>
  Number.isInteger(cell.column) &&
  Number.isInteger(cell.row) &&
  cell.column >= 0 &&
  cell.column < grid.columns &&
  cell.row >= 0 &&
  cell.row < grid.rows

export type Occupant = { readonly kind: 'desk' | 'teacherDesk'; readonly id: string }

/** What sits in a grid cell: a desk, the teacher's desk, or nothing. Walls and doors are not cells. */
export function occupantOf(classroom: Classroom, cell: Cell): Occupant | null {
  const desk = classroom.desks.find((d) => sameCell(d.cell, cell))
  if (desk) return { kind: 'desk', id: desk.id }
  const teacher = classroom.teacherDesk
  return teacher && sameCell(teacher.cell, cell) ? { kind: 'teacherDesk', id: teacher.id } : null
}

/** How many cell-aligned positions a wall has: columns for top and bottom, rows for left and right. */
export const wallLength = (grid: Grid, wall: Wall): number =>
  wall === 'top' || wall === 'bottom' ? grid.columns : grid.rows

/** Door positions are integer indexes within the wall's length; corners are not positions. */
export const doorSpotOnWall = (grid: Grid, wall: Wall, index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index < wallLength(grid, wall)

export const sameDoorSpot = (a: Pick<Door, 'wall' | 'index'>, b: Pick<Door, 'wall' | 'index'>): boolean =>
  a.wall === b.wall && a.index === b.index

const OPPOSITE: Readonly<Record<Wall, Wall>> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** Front, Back and Side labels follow the front wall (FR-6). Derived, never stored. */
export function wallRoles(frontWall: Wall): Readonly<Record<Wall, WallRole>> {
  const roles: Record<Wall, WallRole> = { top: 'side', bottom: 'side', left: 'side', right: 'side' }
  roles[frontWall] = 'front'
  roles[OPPOSITE[frontWall]] = 'back'
  return roles
}

/** Doors cut off when the grid becomes `grid`: a door goes when its aligned column or row does. */
export const doorsOutside = (doors: readonly Door[], grid: Grid): Door[] =>
  doors.filter((d) => !doorSpotOnWall(grid, d.wall, d.index))
