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
    { type: 'placeMarker', id: 'f', kind: 'front', cell: { column: 3, row: 0 } },
    { type: 'placeMarker', id: 'door', kind: 'door', cell: { column: 7, row: 5 } },
    { type: 'placeDesk', id: 'd1', cell: { column: 1, row: 1 } },
    { type: 'placeDesk', id: 'd2', cell: { column: 2, row: 1 } },
    { type: 'addStudent', id: 's1', name: 'Maya' },
    { type: 'addStudent', id: 's2', name: 'Leo' },
    { type: 'addRule', rule: { id: 'r1', type: 'notNear', studentIds: ['s1', 's2'] } },
  )

describe('toRequest', () => {
  it('sends ids and cells only: no names, no non-front markers', () => {
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
  })

  it('is null without a valid Front marker', () => {
    expect(toRequest(emptyClassroom())).toBeNull()
    const corner = { ...room(), markers: [{ id: 'f', kind: 'front' as const, cell: { column: 0, row: 0 } }] }
    expect(toRequest(corner)).toBeNull()
  })
})

describe('staleness', () => {
  const resultFor = (c: Classroom): RunResult => ({
    fingerprint: currentFingerprint(c) as string,
    request: toRequest(c)!,
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
    ['moving the front marker to another edge', { type: 'moveMarker', id: 'f', to: { column: 0, row: 2 } }],
    ['resizing the grid', { type: 'resizeGrid', columns: 9, rows: 6 }],
  ])('is stale after %s', (_name, command) => {
    const c = room()
    const result = resultFor(c)
    const next = applyCommand(c, command)
    expect(next.ok && isOutOfDate(result, next.classroom)).toBe(true)
  })

  it('sliding the front marker along its edge does not change the inputs', () => {
    const c = room()
    const next = applyCommand(c, { type: 'moveMarker', id: 'f', to: { column: 4, row: 0 } })
    expect(next.ok && isOutOfDate(resultFor(c), next.classroom)).toBe(false)
  })

  it('moving a door does not change the inputs', () => {
    const c = room()
    const next = applyCommand(c, { type: 'moveMarker', id: 'door', to: { column: 6, row: 5 } })
    expect(next.ok && isOutOfDate(resultFor(c), next.classroom)).toBe(false)
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
