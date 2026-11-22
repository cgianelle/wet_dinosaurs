import { describe, expect, it } from 'vitest'
import { emptyClassroom, type Command } from './classroom'
import { canRedo, canUndo, editorReducer, initialEditor, nextUndoLabel, type EditorState } from './history'
import type { RunResult } from './results'

const send = (state: EditorState, command: Command): EditorState => editorReducer(state, { type: 'command', command })
const fakeResult = (fingerprint: string): RunResult => ({
  fingerprint,
  request: { grid: { columns: 1, rows: 1 }, frontEdge: 'top', desks: [], students: [], rules: [] },
  snapshot: emptyClassroom(),
  arrangements: [],
})

describe('history', () => {
  it('records accepted commands, ignores rejected ones and names the next undo', () => {
    let s = initialEditor(emptyClassroom())
    s = send(s, { type: 'placeDesk', id: 'd1', cell: { column: 0, row: 0 } })
    s = send(s, { type: 'placeDesk', id: 'd2', cell: { column: 0, row: 0 } })
    expect(s.past).toHaveLength(1)
    expect(s.feedback?.kind).toBe('rejected')
    expect(nextUndoLabel(s)).toBe('add desk')
  })

  it('undoes and redoes, and a new command clears the redo stack', () => {
    let s = initialEditor(emptyClassroom())
    s = send(s, { type: 'placeDesk', id: 'd1', cell: { column: 0, row: 0 } })
    s = editorReducer(s, { type: 'undo' })
    expect(s.present.desks).toEqual([])
    expect(canRedo(s)).toBe(true)
    s = editorReducer(s, { type: 'redo' })
    expect(s.present.desks).toHaveLength(1)
    s = editorReducer(s, { type: 'undo' })
    s = send(s, { type: 'placeDesk', id: 'd2', cell: { column: 1, row: 0 } })
    expect(canRedo(s)).toBe(false)
  })

  it('caps the past at 100 steps', () => {
    let s = initialEditor(emptyClassroom())
    for (let i = 0; i < 120; i++) s = send(s, { type: 'addStudent', id: `s${i}`, name: `n${i}` })
    expect(s.past.length).toBeLessThanOrEqual(100)
  })

  it('treats a bulk command as one step', () => {
    let s = initialEditor(emptyClassroom())
    s = send(s, { type: 'fillRoom', columns: 3, rows: 3, aisle: false, ids: Array.from({ length: 9 }, (_, i) => `d${i}`) })
    expect(s.past).toHaveLength(1)
    expect(editorReducer(s, { type: 'undo' }).present.desks).toEqual([])
  })

  it('does not let undo of an ordinary edit touch stored results', () => {
    let s = initialEditor(emptyClassroom())
    s = send(s, { type: 'placeDesk', id: 'd1', cell: { column: 0, row: 0 } })
    s = editorReducer(s, { type: 'storeResults', result: fakeResult('run-1') })
    s = editorReducer(s, { type: 'undo' })
    expect(s.results?.fingerprint).toBe('run-1')
  })

  it('start over clears results in one undoable step; undo restores room and results together', () => {
    let s = initialEditor(emptyClassroom())
    s = send(s, { type: 'addStudent', id: 's1', name: 'Maya' })
    s = editorReducer(s, { type: 'storeResults', result: fakeResult('run-1') })
    s = send(s, { type: 'startOver' })
    expect(s.results).toBeNull()
    expect(s.present).toEqual(emptyClassroom())
    s = editorReducer(s, { type: 'undo' })
    expect(s.present.students).toHaveLength(1)
    expect(s.results?.fingerprint).toBe('run-1')
    s = editorReducer(s, { type: 'redo' })
    expect(s.results).toBeNull()
  })

  it('a run completed after start over survives; undoing past start over still restores the earlier results', () => {
    let s = initialEditor(emptyClassroom())
    s = editorReducer(s, { type: 'storeResults', result: fakeResult('before') })
    s = send(s, { type: 'startOver' })
    s = editorReducer(s, { type: 'storeResults', result: fakeResult('after') })
    expect(s.results?.fingerprint).toBe('after')
    s = editorReducer(s, { type: 'undo' })
    expect(s.results?.fingerprint).toBe('before')
  })

  it('reports availability of undo and redo', () => {
    const s = initialEditor(emptyClassroom())
    expect([canUndo(s), canRedo(s)]).toEqual([false, false])
    expect(editorReducer(s, { type: 'undo' })).toBe(s)
  })
})
