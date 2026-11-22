import { inGrid, occupantOf } from './geometry'
import { MAX_DESKS, MAX_STUDENTS } from './limits'
import { checkName, nameKey } from './names'
import type { Cell, Classroom } from './types'

export interface FillRequest {
  /** Desk columns and rows to place, starting at the top-left of the room. */
  readonly columns: number
  readonly rows: number
  /** Leave one empty column in the middle of the block. */
  readonly aisle: boolean
}

export type FillPreview =
  | {
      readonly ok: true
      readonly cells: readonly Cell[]
      /** Cells that already hold a desk. */
      readonly replaced: number
      /** Cells skipped because a marker is there. */
      readonly skippedMarkers: number
      readonly totalDesks: number
    }
  | { readonly ok: false; readonly problem: 'doesNotFit' | 'deskLimit' | 'invalid'; readonly totalDesks: number }

/** The cells a Fill room would use, validated with the same limits as the command (FR-29). */
export function previewFill(c: Classroom, request: FillRequest): FillPreview {
  const { columns, rows, aisle } = request
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
    return { ok: false, problem: 'invalid', totalDesks: c.desks.length }
  }
  const useAisle = aisle && columns >= 2
  const width = columns + (useAisle ? 1 : 0)
  if (width > c.grid.columns || rows > c.grid.rows) return { ok: false, problem: 'doesNotFit', totalDesks: c.desks.length }
  const aisleColumn = Math.floor(columns / 2)
  const cells: Cell[] = []
  let skippedMarkers = 0
  let replaced = 0
  for (let row = 0; row < rows; row++) {
    for (let k = 0; k < width; k++) {
      if (useAisle && k === aisleColumn) continue
      const cell = { column: k, row }
      const occupant = occupantOf(c, cell)
      if (occupant && occupant.kind !== 'desk') skippedMarkers++
      else {
        cells.push(cell)
        if (occupant) replaced++
      }
    }
  }
  const totalDesks = c.desks.length + cells.length - replaced
  if (totalDesks > MAX_DESKS) return { ok: false, problem: 'deskLimit', totalDesks }
  if (!cells.every((cell) => inGrid(c.grid, cell))) return { ok: false, problem: 'doesNotFit', totalDesks }
  return { ok: true, cells, replaced, skippedMarkers, totalDesks }
}

export interface PastePreview {
  /** Names that would be added, in order, trimmed. */
  readonly ready: readonly string[]
  /** Names skipped because the class (or the paste itself) already has them. */
  readonly duplicates: readonly string[]
  /** Names skipped because they are longer than the maximum. */
  readonly tooLong: readonly string[]
  /** How many students over the limit the paste would make; 0 when it fits. */
  readonly overLimitBy: number
  readonly totalAfter: number
}

/** One name per line; blank lines ignored; duplicates and bad names reported, never silently dropped (FR-30). */
export function previewPasteList(c: Classroom, text: string): PastePreview {
  const ready: string[] = []
  const duplicates: string[] = []
  const tooLong: string[] = []
  const seen = new Set(c.students.map((s) => nameKey(s.name)))
  for (const line of text.split(/\r?\n/)) {
    const name = line.trim()
    if (name === '') continue
    const check = checkName(name, [])
    if (!check.ok) {
      tooLong.push(name)
      continue
    }
    const key = nameKey(name)
    if (seen.has(key)) duplicates.push(name)
    else {
      seen.add(key)
      ready.push(name)
    }
  }
  const totalAfter = c.students.length + ready.length
  return { ready, duplicates, tooLong, overLimitBy: Math.max(0, totalAfter - MAX_STUDENTS), totalAfter }
}
