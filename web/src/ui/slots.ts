import { occupantOf, wallLength } from '../model/geometry'
import type { Cell, Classroom, Wall } from '../model/types'

/** A spot on the canvas: a grid cell, or one cell-long segment of a wall band (corners are not spots). */
export type Slot =
  | { readonly kind: 'cell'; readonly cell: Cell }
  | { readonly kind: 'wall'; readonly wall: Wall; readonly index: number }

export const slotKey = (slot: Slot): string =>
  slot.kind === 'cell' ? `c:${slot.cell.column},${slot.cell.row}` : `w:${slot.wall}:${slot.index}`

export function slotFromKey(key: string | null | undefined): Slot | null {
  if (!key) return null
  if (key.startsWith('c:')) {
    const [column, row] = key.slice(2).split(',').map(Number)
    return column === undefined || row === undefined || Number.isNaN(column) || Number.isNaN(row)
      ? null
      : { kind: 'cell', cell: { column, row } }
  }
  const [, wall, index] = key.split(':')
  return wall && index !== undefined ? { kind: 'wall', wall: wall as Wall, index: Number(index) } : null
}

export function slotFromEvent(target: EventTarget | null): Slot | null {
  return slotFromKey((target as HTMLElement | null)?.closest?.('[data-slot]')?.getAttribute('data-slot'))
}

/** Extended coordinates: cells are 0..columns-1 by 0..rows-1; the wall ring is one step outside. */
export function toSlot(grid: Classroom['grid'], x: number, y: number): Slot | null {
  const { columns, rows } = grid
  const insideX = x >= 0 && x < columns
  const insideY = y >= 0 && y < rows
  if (insideX && insideY) return { kind: 'cell', cell: { column: x, row: y } }
  if (insideX && y === -1) return { kind: 'wall', wall: 'top', index: x }
  if (insideX && y === rows) return { kind: 'wall', wall: 'bottom', index: x }
  if (insideY && x === -1) return { kind: 'wall', wall: 'left', index: y }
  if (insideY && x === columns) return { kind: 'wall', wall: 'right', index: y }
  return null
}

export function toXY(grid: Classroom['grid'], slot: Slot): { x: number; y: number } {
  if (slot.kind === 'cell') return { x: slot.cell.column, y: slot.cell.row }
  switch (slot.wall) {
    case 'top':
      return { x: slot.index, y: -1 }
    case 'bottom':
      return { x: slot.index, y: grid.rows }
    case 'left':
      return { x: -1, y: slot.index }
    case 'right':
      return { x: grid.columns, y: slot.index }
  }
}

export const clampSlot = (grid: Classroom['grid'], slot: Slot): Slot =>
  slot.kind === 'cell'
    ? { kind: 'cell', cell: { column: Math.min(slot.cell.column, grid.columns - 1), row: Math.min(slot.cell.row, grid.rows - 1) } }
    : { ...slot, index: Math.min(slot.index, wallLength(grid, slot.wall) - 1) }

export const ARROWS: Readonly<Record<string, { x: number; y: number }>> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}


/** What can be picked up and moved: a desk, the teacher's desk (cells) or a door (wall segments). */
export type Item = { readonly kind: 'desk' | 'teacherDesk' | 'door'; readonly id: string }

export function itemAt(classroom: Classroom, slot: Slot): Item | null {
  if (slot.kind === 'cell') return occupantOf(classroom, slot.cell)
  const door = classroom.doors.find((d) => d.wall === slot.wall && d.index === slot.index)
  return door ? { kind: 'door', id: door.id } : null
}

export const sameSlot = (a: Slot, b: Slot): boolean => slotKey(a) === slotKey(b)

/** Every spot on the canvas: the cells row by row, then the four wall bands. */
export function allSlots(grid: Classroom['grid']): Slot[] {
  const slots: Slot[] = []
  for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) slots.push({ kind: 'cell', cell: { column, row } })
  for (const wall of ['top', 'bottom', 'left', 'right'] as const) {
    for (let index = 0; index < wallLength(grid, wall); index++) slots.push({ kind: 'wall', wall, index })
  }
  return slots
}

export const WALL_TITLES: Readonly<Record<Wall, string>> = { top: 'Top wall', bottom: 'Bottom wall', left: 'Left wall', right: 'Right wall' }
export const WALL_POSITION: Readonly<Record<Wall, (index: number) => string>> = {
  top: (i) => `above column ${i + 1}`,
  bottom: (i) => `below column ${i + 1}`,
  left: (i) => `left of row ${i + 1}`,
  right: (i) => `right of row ${i + 1}`,
}
