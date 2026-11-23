import { describe, expect, it } from 'vitest'
import { applyCommand, emptyClassroom, type Command } from './classroom'
import { editorReducer, initialEditor } from './history'
import { currentFingerprint, toRequest } from './request'
import { isOutOfDate, type RunResult } from './results'
import type { Classroom } from './types'

const build = (...commands: Command[]): Classroom =>
  commands.reduce((c, command) => {
    const r = applyCommand(c, command)
    if (!r.ok) throw new Error(JSON.stringify(r.rejection))
    return r.classroom
  }, emptyClassroom())

const room = () =>
  build(
    { type: 'placeTeacherDesk', id: 'teacher', cell: { column: 7, row: 0 } },
    { type: 'placeDoor', id: 'door', wall: 'bottom', index: 7 },
    { type: 'placeDesk', id: 'd1', cell: { column: 1, row: 1 } },
    { type: 'placeDesk', id: 'd2', cell: { column: 2, row: 1 } },
    { type: 'addStudent', id: 's1', name: 'Maya' },
    { type: 'addStudent', id: 's2', name: 'Leo' },
    { type: 'addRule', rule: { id: 'r1', type: 'notNear', studentIds: ['s1', 's2'] } },
  )

describe('toRequest', () => {
  it('sends ids and cells only: no names, doors or teacher desk', () => {
    const request = toRequest(room())
    expect(request).toEqual({
      grid: { columns: 8, rows: 6 },
      frontEdge: 'top',
      desks: [{ id: 'd1', column: 1, row: 1 }, { id: 'd2', column: 2, row: 1 }],
      students: [{ id: 's1' }, { id: 's2' }],
      rules: [{ id: 'r1', type: 'notNear', studentIds: ['s1', 's2'] }],
    })
    const text = JSON.stringify(request)
    expect(text).not.toContain('Maya')
    expect(text).not.toContain('door')
    expect(text).not.toContain('teacher')
  })

  it.each(['top', 'bottom', 'left', 'right'] as const)('copies the %s front wall verbatim', (wall) => {
    const c = applyCommand(room(), { type: 'setFrontWall', wall })
    expect(c.ok && toRequest(c.classroom).frontEdge).toBe(wall)
  })

  it('always has a front: even an empty 1 x 1 room produces a request', () => {
    const tiny = applyCommand(emptyClassroom(), { type: 'resizeGrid', columns: 1, rows: 1 })
    expect(tiny.ok && toRequest(tiny.classroom).frontEdge).toBe('top')
  })
})

describe('staleness', () => {
  const resultFor = (c: Classroom): RunResult => ({
    fingerprint: currentFingerprint(c),
    request: toRequest(c),
    snapshot: c,
    arrangements: [],
  })

  it('is not stale for the exact inputs, and a rename alone does not make it stale', () => {
    const c = room()
    const result = resultFor(c)
    expect(isOutOfDate(result, c)).toBe(false)
    const renamed = applyCommand(c, { type: 'editStudent', id: 's1', name: 'Maya R.' })
    expect(renamed.ok && isOutOfDate(result, renamed.classroom)).toBe(false)
  })

  it.each<[string, Command]>([
    ['moving a desk', { type: 'moveDesk', id: 'd1', to: { column: 5, row: 5 } }],
    ['removing a rule', { type: 'removeRule', id: 'r1' }],
    ['removing a student', { type: 'removeStudent', id: 's2' }],
    ['changing the front wall', { type: 'setFrontWall', wall: 'left' }],
    ['resizing the grid', { type: 'resizeGrid', columns: 9, rows: 6 }],
  ])('is stale after %s', (_name, command) => {
    const c = room()
    const result = resultFor(c)
    const next = applyCommand(c, command)
    expect(next.ok && isOutOfDate(result, next.classroom)).toBe(true)
  })

  it.each<[string, Command]>([
    ['moving a door', { type: 'moveDoor', id: 'door', wall: 'bottom', index: 6 }],
    ['removing a door', { type: 'removeDoor', id: 'door' }],
    ['placing another door', { type: 'placeDoor', id: 'door2', wall: 'top', index: 0 }],
    ["moving the teacher's desk", { type: 'moveTeacherDesk', to: { column: 6, row: 0 } }],
    ["removing the teacher's desk", { type: 'removeTeacherDesk' }],
  ])('is not stale after %s (FR-23)', (_name, command) => {
    const c = room()
    const next = applyCommand(c, command)
    expect(next.ok && isOutOfDate(resultFor(c), next.classroom)).toBe(false)
  })

  it('keeps the run snapshot of the front wall, doors and teacher desk', () => {
    const c = room()
    const result = resultFor(c)
    const next = applyCommand(c, { type: 'setFrontWall', wall: 'right' })
    expect(next.ok && isOutOfDate(result, next.classroom)).toBe(true)
    expect(result.snapshot.frontWall).toBe('top')
    expect(result.snapshot.doors).toHaveLength(1)
    expect(result.snapshot.teacherDesk?.id).toBe('teacher')
  })

  it('does not depend on the order of desks, students or rules in the list', () => {
    const c = room()
    const shuffled = { ...c, desks: [...c.desks].reverse(), students: [...c.students].reverse() }
    expect(isOutOfDate(resultFor(c), shuffled)).toBe(false)
  })

  it('undo back to the run inputs clears the badge', () => {
    let s = initialEditor(room())
    const result = resultFor(s.present)
    s = editorReducer(s, { type: 'storeResults', result })
    s = editorReducer(s, { type: 'command', command: { type: 'moveDesk', id: 'd1', to: { column: 5, row: 5 } } })
    expect(isOutOfDate(result, s.present)).toBe(true)
    s = editorReducer(s, { type: 'undo' })
    expect(isOutOfDate(result, s.present)).toBe(false)
  })
})
