import { describe, expect, it } from 'vitest'
import { doorSpotOnWall, doorsOutside, occupantOf, wallLength, wallRoles } from './geometry'
import { emptyClassroom } from './classroom'

describe('wallRoles', () => {
  it('labels the front wall, its opposite as Back, and the other two as Side', () => {
    expect(wallRoles('top')).toEqual({ top: 'front', bottom: 'back', left: 'side', right: 'side' })
    expect(wallRoles('bottom')).toEqual({ top: 'back', bottom: 'front', left: 'side', right: 'side' })
    expect(wallRoles('left')).toEqual({ top: 'side', bottom: 'side', left: 'front', right: 'back' })
    expect(wallRoles('right')).toEqual({ top: 'side', bottom: 'side', left: 'back', right: 'front' })
  })
})

describe('wall positions', () => {
  const grid = { columns: 5, rows: 4 }

  it('measure columns for top and bottom walls and rows for left and right walls', () => {
    expect(wallLength(grid, 'top')).toBe(5)
    expect(wallLength(grid, 'bottom')).toBe(5)
    expect(wallLength(grid, 'left')).toBe(4)
    expect(wallLength(grid, 'right')).toBe(4)
  })

  it('exclude corners and anything outside the wall', () => {
    expect(doorSpotOnWall(grid, 'top', 0)).toBe(true)
    expect(doorSpotOnWall(grid, 'top', 4)).toBe(true)
    expect(doorSpotOnWall(grid, 'top', 5)).toBe(false)
    expect(doorSpotOnWall(grid, 'left', 3)).toBe(true)
    expect(doorSpotOnWall(grid, 'left', 4)).toBe(false)
    expect(doorSpotOnWall(grid, 'left', 1.5)).toBe(false)
  })

  it('cut off a door exactly when its aligned column or row goes', () => {
    const doors = [
      { id: 'a', wall: 'top' as const, index: 4 },
      { id: 'b', wall: 'left' as const, index: 3 },
    ]
    expect(doorsOutside(doors, { columns: 4, rows: 4 }).map((d) => d.id)).toEqual(['a'])
    expect(doorsOutside(doors, { columns: 5, rows: 3 }).map((d) => d.id)).toEqual(['b'])
    expect(doorsOutside(doors, { columns: 5, rows: 4 })).toEqual([])
  })
})

describe('occupantOf', () => {
  it('finds a desk, the teacher desk, or nothing; walls and doors are never cells', () => {
    const c = {
      ...emptyClassroom(),
      desks: [{ id: 'd', cell: { column: 1, row: 1 } }],
      teacherDesk: { id: 't', cell: { column: 0, row: 0 } },
      doors: [{ id: 'door', wall: 'top' as const, index: 3 }],
    }
    expect(occupantOf(c, { column: 1, row: 1 })).toEqual({ kind: 'desk', id: 'd' })
    expect(occupantOf(c, { column: 0, row: 0 })).toEqual({ kind: 'teacherDesk', id: 't' })
    expect(occupantOf(c, { column: 3, row: 0 })).toBeNull()
  })
})
