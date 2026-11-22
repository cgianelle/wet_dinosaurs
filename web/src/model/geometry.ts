import type { Cell, Classroom, Edge, Grid, MarkerKind } from './types'

export const sameCell = (a: Cell, b: Cell): boolean => a.column === b.column && a.row === b.row

export const inGrid = (grid: Grid, cell: Cell): boolean =>
  Number.isInteger(cell.column) &&
  Number.isInteger(cell.row) &&
  cell.column >= 0 &&
  cell.column < grid.columns &&
  cell.row >= 0 &&
  cell.row < grid.rows

export type Occupant =
  | { readonly kind: 'desk'; readonly id: string }
  | { readonly kind: MarkerKind; readonly id: string }

export function occupantOf(classroom: Classroom, cell: Cell): Occupant | null {
  const desk = classroom.desks.find((d) => sameCell(d.cell, cell))
  if (desk) return { kind: 'desk', id: desk.id }
  const marker = classroom.markers.find((m) => sameCell(m.cell, cell))
  return marker ? { kind: marker.kind, id: marker.id } : null
}

/**
 * The edge a Front marker at `cell` marks, or null when the cell is a corner, interior or off the grid.
 * A cell touching two opposite edges (a one-wide or one-tall room) resolves to left, or top (AD-11).
 */
export function frontEdgeOf(grid: Grid, cell: Cell): Edge | null {
  if (!inGrid(grid, cell)) return null
  const onLeft = cell.column === 0
  const onRight = cell.column === grid.columns - 1
  const onTop = cell.row === 0
  const onBottom = cell.row === grid.rows - 1
  const isCorner = (onLeft || onRight) && (onTop || onBottom)
  if (isCorner) return null
  if (onLeft) return 'left'
  if (onRight) return 'right'
  if (onTop) return 'top'
  if (onBottom) return 'bottom'
  return null
}

/** The Front tool is unavailable only when both dimensions are 2 or less (AD-11). */
export const hasValidFrontCell = (grid: Grid): boolean => grid.columns >= 3 || grid.rows >= 3

export function validFrontCells(grid: Grid): Cell[] {
  const cells: Cell[] = []
  for (let row = 0; row < grid.rows; row++) {
    for (let column = 0; column < grid.columns; column++) {
      if (frontEdgeOf(grid, { column, row })) cells.push({ column, row })
    }
  }
  return cells
}
