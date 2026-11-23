import { describe, expect, it } from 'vitest'
import { applyCommand, emptyClassroom, resizeLoss, type Command, type Rejection } from './classroom'
import type { Classroom } from './types'

const run = (c: Classroom, ...commands: Command[]): Classroom =>
  commands.reduce((state, command) => {
    const result = applyCommand(state, command)
    if (!result.ok) throw new Error(`unexpected rejection ${JSON.stringify(result.rejection)}`)
    return result.classroom
  }, c)

const rejection = (c: Classroom, command: Command): Rejection => {
  const result = applyCommand(c, command)
  if (result.ok) throw new Error('expected a rejection')
  return result.rejection
}

const desk = (id: string, column: number, row: number): Command => ({ type: 'placeDesk', id, cell: { column, row } })

describe('desks', () => {
  it('places, moves and removes desks', () => {
    const c = run(emptyClassroom(), desk('d1', 0, 0), { type: 'moveDesk', id: 'd1', to: { column: 2, row: 1 } })
    expect(c.desks).toEqual([{ id: 'd1', cell: { column: 2, row: 1 } }])
    expect(run(c, { type: 'removeDesk', id: 'd1' }).desks).toEqual([])
  })

  it('rejects a drop on an occupied cell and leaves the room unchanged', () => {
    const c = run(emptyClassroom(), desk('d1', 0, 0), desk('d2', 1, 0))
    expect(rejection(c, { type: 'moveDesk', id: 'd2', to: { column: 0, row: 0 } })).toEqual({ reason: 'cellOccupied' })
    expect(rejection(c, desk('d3', 0, 0))).toEqual({ reason: 'cellOccupied' })
  })

  it('rejects cells outside the grid', () => {
    expect(rejection(emptyClassroom(), desk('d', 8, 0))).toEqual({ reason: 'outOfGrid' })
    expect(rejection(emptyClassroom(), desk('d', 0, -1))).toEqual({ reason: 'outOfGrid' })
    expect(rejection(emptyClassroom(), desk('d', 0.5, 0))).toEqual({ reason: 'outOfGrid' })
  })

  it('refuses a 51st desk by every route', () => {
    let c = run(emptyClassroom(), { type: 'resizeGrid', columns: 15, rows: 15 })
    for (let i = 0; i < 50; i++) c = run(c, desk(`d${i}`, i % 15, Math.floor(i / 15)))
    expect(rejection(c, desk('extra', 14, 14))).toEqual({ reason: 'deskLimit' })
    expect(rejection(c, { type: 'fillRoom', columns: 5, rows: 5, aisle: false, ids: Array.from({ length: 25 }, (_, i) => `n${i}`) })).toEqual({
      reason: 'fillRejected',
    })
    expect(run(c, { type: 'moveDesk', id: 'd0', to: { column: 14, row: 14 } }).desks).toHaveLength(50)
  })
})

describe('front wall', () => {
  it('defaults to top and is never rejected, for any of the four walls', () => {
    expect(emptyClassroom().frontWall).toBe('top')
    for (const wall of ['top', 'bottom', 'left', 'right'] as const) {
      expect(run(emptyClassroom(), { type: 'setFrontWall', wall }).frontWall).toBe(wall)
    }
  })

  it('moves no desk, door or teacher desk', () => {
    const before = run(emptyClassroom(), desk('d', 1, 1), { type: 'placeDoor', id: 'door', wall: 'top', index: 2 })
    const after = run(before, { type: 'setFrontWall', wall: 'left' })
    expect({ ...after, frontWall: 'top' }).toEqual(before)
  })
})

describe('teacher desk', () => {
  it('shares the grid with desks: one object per cell', () => {
    const c = run(emptyClassroom(), desk('d', 2, 2))
    expect(rejection(c, { type: 'placeTeacherDesk', id: 't', cell: { column: 2, row: 2 } })).toEqual({ reason: 'cellOccupied' })
    const withTeacher = run(c, { type: 'placeTeacherDesk', id: 't', cell: { column: 0, row: 0 } })
    expect(rejection(withTeacher, desk('d2', 0, 0))).toEqual({ reason: 'cellOccupied' })
  })

  it('allows at most one, and it is not a desk for the cap or the count', () => {
    const c = run(emptyClassroom(), { type: 'placeTeacherDesk', id: 't', cell: { column: 0, row: 0 } })
    expect(rejection(c, { type: 'placeTeacherDesk', id: 'u', cell: { column: 1, row: 0 } })).toEqual({ reason: 'teacherDeskLimit' })
    expect(c.desks).toHaveLength(0)
  })

  it('moves and removes, and refuses an occupied cell', () => {
    let c = run(emptyClassroom(), desk('d', 1, 0), { type: 'placeTeacherDesk', id: 't', cell: { column: 0, row: 0 } })
    expect(rejection(c, { type: 'moveTeacherDesk', to: { column: 1, row: 0 } })).toEqual({ reason: 'cellOccupied' })
    c = run(c, { type: 'moveTeacherDesk', to: { column: 3, row: 3 } })
    expect(c.teacherDesk).toEqual({ id: 't', cell: { column: 3, row: 3 } })
    expect(run(c, { type: 'removeTeacherDesk' }).teacherDesk).toBeNull()
  })
})

describe('doors', () => {
  const door = (id: string, wall: 'top' | 'bottom' | 'left' | 'right', index: number): Command => ({ type: 'placeDoor', id, wall, index })

  it('are wall openings, not cells: a door never blocks a grid cell', () => {
    const c = run(emptyClassroom(), door('a', 'top', 0), desk('d', 0, 0))
    expect(c.desks).toHaveLength(1)
  })

  it('accept every position along a wall and nothing past its length', () => {
    const c = emptyClassroom() // 8 columns, 6 rows
    expect(run(c, door('a', 'top', 7)).doors).toHaveLength(1)
    expect(run(c, door('a', 'left', 5)).doors).toHaveLength(1)
    expect(rejection(c, door('a', 'top', 8))).toEqual({ reason: 'doorOffWall' })
    expect(rejection(c, door('a', 'right', 6))).toEqual({ reason: 'doorOffWall' })
    expect(rejection(c, door('a', 'bottom', -1))).toEqual({ reason: 'doorOffWall' })
  })

  it('allows several on one wall but not two at one position, and at most three in total', () => {
    let c = run(emptyClassroom(), door('a', 'top', 1), door('b', 'top', 2))
    expect(rejection(c, door('c', 'top', 1))).toEqual({ reason: 'doorSpotTaken' })
    c = run(c, door('c', 'left', 1))
    expect(rejection(c, door('d', 'bottom', 0))).toEqual({ reason: 'doorLimit' })
  })

  it('move along or between walls, but not onto a taken spot', () => {
    const c = run(emptyClassroom(), door('a', 'top', 1), door('b', 'top', 2))
    expect(rejection(c, { type: 'moveDoor', id: 'a', wall: 'top', index: 2 })).toEqual({ reason: 'doorSpotTaken' })
    expect(run(c, { type: 'moveDoor', id: 'a', wall: 'right', index: 3 }).doors[0]).toEqual({ id: 'a', wall: 'right', index: 3 })
    expect(run(c, { type: 'removeDoor', id: 'a' }).doors.map((d) => d.id)).toEqual(['b'])
  })
})

describe('resizeGrid', () => {
  const room = () =>
    run(
      emptyClassroom(),
      desk('d1', 7, 5),
      desk('d2', 0, 0),
      { type: 'placeTeacherDesk', id: 't', cell: { column: 6, row: 0 } },
      { type: 'placeDoor', id: 'top-door', wall: 'top', index: 6 },
      { type: 'placeDoor', id: 'side-door', wall: 'left', index: 2 },
    )

  it('refuses sizes beyond 15 x 15 and below 1', () => {
    expect(rejection(emptyClassroom(), { type: 'resizeGrid', columns: 16, rows: 6 })).toEqual({
      reason: 'gridLimit',
      field: 'grid.columns',
    })
    expect(rejection(emptyClassroom(), { type: 'resizeGrid', columns: 8, rows: 16 })).toEqual({
      reason: 'gridLimit',
      field: 'grid.rows',
    })
    expect(rejection(emptyClassroom(), { type: 'resizeGrid', columns: 0, rows: 6 })).toEqual({ reason: 'gridTooSmall' })
  })

  it('asks for confirmation instead of silently clipping', () => {
    expect(rejection(room(), { type: 'resizeGrid', columns: 6, rows: 4 })).toEqual({
      reason: 'resizeRemoves',
      desks: 1,
      teacherDesk: true,
      doors: 1,
    })
    expect(resizeLoss(room(), 6, 4).desks).toHaveLength(1)
  })

  it('removes what is cut off once confirmed', () => {
    const c = run(room(), { type: 'resizeGrid', columns: 6, rows: 4, confirmed: true })
    expect(c.desks.map((d) => d.id)).toEqual(['d2'])
    expect(c.teacherDesk).toBeNull()
    expect(c.doors.map((d) => d.id)).toEqual(['side-door'])
  })

  it('removes a door only when its aligned column or row is cut off', () => {
    const c = run(room(), { type: 'resizeGrid', columns: 8, rows: 2, confirmed: true })
    expect(c.doors.map((d) => d.id)).toEqual(['top-door'])
    expect(rejection(room(), { type: 'resizeGrid', columns: 6, rows: 6 })).toMatchObject({ doors: 1, desks: 1 })
  })

  it('never loses a wall', () => {
    expect(run(room(), { type: 'resizeGrid', columns: 1, rows: 1, confirmed: true }).frontWall).toBe('top')
  })

  it('grows without confirmation', () => {
    expect(run(room(), { type: 'resizeGrid', columns: 10, rows: 10 }).grid).toEqual({ columns: 10, rows: 10 })
  })
})

describe('students', () => {
  const add = (id: string, name: string): Command => ({ type: 'addStudent', id, name })

  it('trims and stores the name exactly as entered', () => {
    expect(run(emptyClassroom(), add('s1', '  Maya  ')).students).toEqual([{ id: 's1', name: 'Maya' }])
  })

  it('rejects empty, too long and duplicate names (case and normalization insensitive)', () => {
    const c = run(emptyClassroom(), add('s1', 'Zoé'))
    expect(rejection(c, add('s2', '   '))).toEqual({ reason: 'invalidName', problem: 'empty' })
    expect(rejection(c, add('s2', 'x'.repeat(41)))).toEqual({ reason: 'invalidName', problem: 'tooLong' })
    expect(rejection(c, add('s2', 'ZOÉ'))).toEqual({ reason: 'invalidName', problem: 'duplicate' })
    expect(run(c, add('s2', 'x'.repeat(40))).students).toHaveLength(2)
  })

  it('refuses the 51st student', () => {
    let c = emptyClassroom()
    for (let i = 0; i < 50; i++) c = run(c, add(`s${i}`, `Student ${i}`))
    expect(rejection(c, add('s50', 'One more'))).toEqual({ reason: 'studentLimit' })
  })

  it('renames without losing rules; a rename may keep its own name', () => {
    let c = run(emptyClassroom(), add('s1', 'Maya'), add('s2', 'Leo'), { type: 'addRule', rule: { id: 'r1', type: 'front', studentId: 's1' } })
    c = run(c, { type: 'editStudent', id: 's1', name: 'MAYA' })
    expect(c.students[0]?.name).toBe('MAYA')
    expect(c.rules).toHaveLength(1)
    expect(rejection(c, { type: 'editStudent', id: 's1', name: 'leo' })).toEqual({ reason: 'invalidName', problem: 'duplicate' })
  })

  it('removing a student cascades their rules and reports how many', () => {
    const c = run(
      emptyClassroom(),
      add('s1', 'Maya'),
      add('s2', 'Leo'),
      add('s3', 'Sam'),
      { type: 'addRule', rule: { id: 'r1', type: 'front', studentId: 's1' } },
      { type: 'addRule', rule: { id: 'r2', type: 'notNear', studentIds: ['s2', 's1'] } },
      { type: 'addRule', rule: { id: 'r3', type: 'isle', studentId: 's3' } },
    )
    const result = applyCommand(c, { type: 'removeStudent', id: 's1' })
    expect(result.ok && result.info.removedRules).toBe(2)
    expect(result.ok && result.classroom.rules.map((r) => r.id)).toEqual(['r3'])
  })

  it('addStudents adds the valid names and reports the skipped ones', () => {
    const c = run(emptyClassroom(), add('s1', 'Maya'))
    const result = applyCommand(c, {
      type: 'addStudents',
      students: [
        { id: 'a', name: 'Leo' },
        { id: 'b', name: 'maya' },
        { id: 'c', name: 'Sam' },
      ],
    })
    expect(result.ok && result.info.added?.map((s) => s.name)).toEqual(['Leo', 'Sam'])
    expect(result.ok && result.info.skippedNames).toEqual(['maya'])
  })

  it('addStudents is atomic about the 50 limit', () => {
    let c = emptyClassroom()
    for (let i = 0; i < 49; i++) c = run(c, add(`s${i}`, `S${i}`))
    const students = [{ id: 'x', name: 'A' }, { id: 'y', name: 'B' }]
    expect(rejection(c, { type: 'addStudents', students })).toEqual({ reason: 'studentLimit' })
    expect(c.students).toHaveLength(49)
  })
})

describe('rules', () => {
  const base = () =>
    run(
      emptyClassroom(),
      { type: 'addStudent', id: 's1', name: 'Maya' },
      { type: 'addStudent', id: 's2', name: 'Leo' },
      { type: 'addRule', rule: { id: 'r1', type: 'notNear', studentIds: ['s1', 's2'] } },
      { type: 'addRule', rule: { id: 'r2', type: 'front', studentId: 's1' } },
    )

  it('blocks a duplicate, including a reversed not-near pair', () => {
    const c = base()
    expect(rejection(c, { type: 'addRule', rule: { id: 'r3', type: 'notNear', studentIds: ['s2', 's1'] } })).toEqual({
      reason: 'invalidRule',
      problem: 'duplicate',
    })
    expect(rejection(c, { type: 'addRule', rule: { id: 'r3', type: 'front', studentId: 's1' } })).toEqual({
      reason: 'invalidRule',
      problem: 'duplicate',
    })
  })

  it('blocks a self pair and a missing student', () => {
    const c = base()
    expect(rejection(c, { type: 'addRule', rule: { id: 'r3', type: 'notNear', studentIds: ['s1', 's1'] } })).toEqual({
      reason: 'invalidRule',
      problem: 'selfPair',
    })
    expect(rejection(c, { type: 'addRule', rule: { id: 'r3', type: 'isle', studentId: 'ghost' } })).toEqual({
      reason: 'invalidRule',
      problem: 'unknownStudent',
    })
  })

  it('allows Front and Isle on the same student', () => {
    expect(run(base(), { type: 'addRule', rule: { id: 'r3', type: 'isle', studentId: 's1' } }).rules).toHaveLength(3)
  })

  it('edits a rule in place and may keep its own pair', () => {
    const c = run(base(), { type: 'editRule', rule: { id: 'r1', type: 'notNear', studentIds: ['s2', 's1'] } })
    expect(c.rules[0]).toEqual({ id: 'r1', type: 'notNear', studentIds: ['s2', 's1'] })
  })
})

describe('fillRoom', () => {
  it("places a rectangle, skipping the teacher's desk cell, in one command", () => {
    const c = run(emptyClassroom(), { type: 'placeTeacherDesk', id: 'm', cell: { column: 1, row: 0 } })
    const ids = Array.from({ length: 6 }, (_, i) => `n${i}`)
    const filled = run(c, { type: 'fillRoom', columns: 3, rows: 2, aisle: false, ids })
    expect(filled.desks).toHaveLength(5)
    expect(filled.desks.some((d) => d.cell.column === 1 && d.cell.row === 0)).toBe(false)
  })

  it('leaves a centre aisle column', () => {
    const filled = run(emptyClassroom(), { type: 'fillRoom', columns: 4, rows: 1, aisle: true, ids: ['a', 'b', 'c', 'd'] })
    expect(filled.desks.map((d) => d.cell.column)).toEqual([0, 1, 3, 4])
  })

  it('is rejected, never partial, when it does not fit', () => {
    expect(rejection(emptyClassroom(), { type: 'fillRoom', columns: 9, rows: 1, aisle: false, ids: Array(9).fill('x') })).toEqual({
      reason: 'fillRejected',
    })
  })
})

describe('startOver', () => {
  it('empties everything', () => {
    const c = run(
      emptyClassroom(),
      desk('d', 0, 0),
      { type: 'placeDoor', id: 'door', wall: 'top', index: 0 },
      { type: 'placeTeacherDesk', id: 't', cell: { column: 3, row: 3 } },
      { type: 'setFrontWall', wall: 'right' },
      { type: 'addStudent', id: 's', name: 'A' },
      { type: 'startOver' },
    )
    expect(c).toEqual(emptyClassroom())
    expect(c.frontWall).toBe('top')
  })
})
