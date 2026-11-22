import { describe, expect, it } from 'vitest'
import { frontEdgeOf, hasValidFrontCell, validFrontCells } from './geometry'

describe('frontEdgeOf', () => {
  const grid = { columns: 5, rows: 4 }

  it('names the edge a non-corner border cell touches', () => {
    expect(frontEdgeOf(grid, { column: 2, row: 0 })).toBe('top')
    expect(frontEdgeOf(grid, { column: 2, row: 3 })).toBe('bottom')
    expect(frontEdgeOf(grid, { column: 0, row: 1 })).toBe('left')
    expect(frontEdgeOf(grid, { column: 4, row: 2 })).toBe('right')
  })

  it('rejects corners, interior cells and cells off the grid', () => {
    for (const cell of [{ column: 0, row: 0 }, { column: 4, row: 3 }, { column: 0, row: 3 }, { column: 4, row: 0 }]) {
      expect(frontEdgeOf(grid, cell)).toBeNull()
    }
    expect(frontEdgeOf(grid, { column: 2, row: 2 })).toBeNull()
    expect(frontEdgeOf(grid, { column: 5, row: 0 })).toBeNull()
  })

  it('resolves one-wide rooms to left and one-tall rooms to top', () => {
    expect(frontEdgeOf({ columns: 1, rows: 5 }, { column: 0, row: 2 })).toBe('left')
    expect(frontEdgeOf({ columns: 5, rows: 1 }, { column: 2, row: 0 })).toBe('top')
    expect(frontEdgeOf({ columns: 1, rows: 5 }, { column: 0, row: 0 })).toBeNull()
  })

  it('has no valid cell exactly when both dimensions are 2 or less', () => {
    for (let columns = 1; columns <= 6; columns++) {
      for (let rows = 1; rows <= 6; rows++) {
        const grid = { columns, rows }
        expect(validFrontCells(grid).length > 0).toBe(hasValidFrontCell(grid))
        expect(hasValidFrontCell(grid)).toBe(columns >= 3 || rows >= 3)
      }
    }
  })
})
