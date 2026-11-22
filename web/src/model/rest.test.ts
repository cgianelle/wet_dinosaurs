import { describe, expect, it } from 'vitest'
import { runBlockers } from './blockers'
import { previewFill, previewPasteList } from './bulk'
import { emptyClassroom } from './classroom'
import type { Arrangement } from './contract'
import { MARKER_LIMITS, MAX_DESKS, MAX_STUDENTS, limitMessage } from './limits'
import { fewestBrokenOption, formatScore } from './results'
import type { Classroom } from './types'

const withDesksAndStudents = (desks: number, students: number): Classroom => ({
  ...emptyClassroom(),
  desks: Array.from({ length: desks }, (_, i) => ({ id: `d${i}`, cell: { column: i % 8, row: Math.floor(i / 8) } })),
  students: Array.from({ length: students }, (_, i) => ({ id: `s${i}`, name: `Student ${i}` })),
})

describe('runBlockers', () => {
  it('lists every problem of an empty room in order', () => {
    expect(runBlockers(emptyClassroom())).toEqual([{ kind: 'noStudents' }, { kind: 'noFrontMarker' }])
  })

  it('carries the signed difference of a count mismatch', () => {
    const c = withDesksAndStudents(5, 3)
    expect(runBlockers(c)).toContainEqual({ kind: 'countMismatch', students: 3, desks: 5 })
  })

  it('flags a front marker left in a corner after an edit', () => {
    const c = { ...withDesksAndStudents(1, 1), markers: [{ id: 'f', kind: 'front' as const, cell: { column: 0, row: 0 } }] }
    expect(runBlockers(c)).toEqual([{ kind: 'frontMarkerNotOnEdge' }])
  })

  it('is empty for a runnable room, with zero rules', () => {
    const c = { ...withDesksAndStudents(2, 2), markers: [{ id: 'f', kind: 'front' as const, cell: { column: 3, row: 0 } }] }
    expect(runBlockers(c)).toEqual([])
  })

  it('reports an orphaned rule', () => {
    const c = {
      ...withDesksAndStudents(1, 1),
      markers: [{ id: 'f', kind: 'front' as const, cell: { column: 3, row: 0 } }],
      rules: [{ id: 'r', type: 'front' as const, studentId: 'ghost' }],
    }
    expect(runBlockers(c)).toEqual([{ kind: 'ruleError', ruleId: 'r', reason: 'unknownStudent' }])
  })
})

describe('previewPasteList', () => {
  it('flags duplicates inside the paste and against the class, ignores blank lines', () => {
    const c = withDesksAndStudents(0, 1)
    const p = previewPasteList(c, 'Maya\n\n  maya \nLeo\r\nStudent 0\nx'.concat('y'.repeat(50)))
    expect(p.ready).toEqual(['Maya', 'Leo'])
    expect(p.duplicates).toEqual(['maya', 'Student 0'])
    expect(p.tooLong).toHaveLength(1)
    expect(p.overLimitBy).toBe(0)
  })

  it('reports how many names too many the paste has', () => {
    const c = withDesksAndStudents(0, 48)
    const p = previewPasteList(c, 'a\nb\nc\nd')
    expect(p.totalAfter).toBe(52)
    expect(p.overLimitBy).toBe(2)
  })
})

describe('previewFill', () => {
  it('counts replaced desks and skipped markers', () => {
    const c: Classroom = {
      ...withDesksAndStudents(2, 0),
      markers: [{ id: 'm', kind: 'door', cell: { column: 2, row: 0 } }],
    }
    const p = previewFill(c, { columns: 3, rows: 1, aisle: false })
    expect(p).toMatchObject({ ok: true, replaced: 2, skippedMarkers: 1, totalDesks: 2 })
  })

  it('refuses a block that would exceed the desk limit, in the preview', () => {
    const c: Classroom = { ...emptyClassroom(), grid: { columns: 15, rows: 15 } }
    expect(previewFill(c, { columns: 8, rows: 7, aisle: false })).toMatchObject({ ok: false, problem: 'deskLimit', totalDesks: 56 })
  })

  it('refuses a block wider than the room, counting the aisle column', () => {
    expect(previewFill(emptyClassroom(), { columns: 8, rows: 1, aisle: true })).toMatchObject({ ok: false, problem: 'doesNotFit' })
  })
})

describe('results helpers', () => {
  const arrangement = (rank: number, rulesMet: number, rulesTotal: number): Arrangement => ({
    rank,
    scores: { front: 0, nearBy: 0, isle: 0, total: 0, weighted100: 0 },
    rulesMet,
    rulesTotal,
    assignments: [],
    outcomes: [],
  })

  it('names the option with the highest rulesMet, ties to the lower rank', () => {
    expect(fewestBrokenOption([arrangement(1, 7, 10), arrangement(2, 9, 10), arrangement(3, 9, 10)])?.rank).toBe(2)
  })

  it('says nothing when some option meets every rule or there are no arrangements', () => {
    expect(fewestBrokenOption([arrangement(1, 7, 10), arrangement(2, 10, 10)])).toBeNull()
    expect(fewestBrokenOption([])).toBeNull()
  })

  it('formats weighted100 as signed hundredths with a real minus sign', () => {
    expect(formatScore(1240)).toBe('12.40')
    expect(formatScore(5)).toBe('0.05')
    expect(formatScore(-1240)).toBe('−12.40')
    expect(formatScore(0)).toBe('0.00')
  })
})

describe('limits', () => {
  it('holds the contract numbers and wording', () => {
    expect(MAX_DESKS).toBe(50)
    expect(MAX_STUDENTS).toBe(50)
    expect(MARKER_LIMITS).toEqual({ front: 1, back: 1, side: 2, door: 3, teacherDesk: 1 })
    expect(limitMessage('desks')).toBe('Room is full (50 desks).')
  })
})
