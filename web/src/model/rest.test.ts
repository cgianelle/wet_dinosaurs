import { describe, expect, it } from 'vitest'
import { runBlockers } from './blockers'
import { previewFill, previewPasteList } from './bulk'
import { emptyClassroom } from './classroom'
import type { Arrangement } from './contract'
import { MAX_DESKS, MAX_DOORS, MAX_STUDENTS, MAX_TEACHER_DESKS, limitMessage } from './limits'
import { fewestBrokenOption, formatScore } from './results'
import type { Classroom } from './types'

const withDesksAndStudents = (desks: number, students: number): Classroom => ({
  ...emptyClassroom(),
  desks: Array.from({ length: desks }, (_, i) => ({ id: `d${i}`, cell: { column: i % 8, row: Math.floor(i / 8) } })),
  students: Array.from({ length: students }, (_, i) => ({ id: `s${i}`, name: `Student ${i}` })),
})

describe('runBlockers', () => {
  it('lists every problem of an empty room in order', () => {
    expect(runBlockers(emptyClassroom())).toEqual([{ kind: 'noStudents' }])
  })

  it('carries the signed difference of a count mismatch', () => {
    const c = withDesksAndStudents(5, 3)
    expect(runBlockers(c)).toContainEqual({ kind: 'countMismatch', students: 3, desks: 5 })
  })

  it("never counts the teacher's desk as a desk", () => {
    const c = { ...withDesksAndStudents(2, 2), teacherDesk: { id: 't', cell: { column: 7, row: 5 } } }
    expect(runBlockers(c)).toEqual([])
  })

  it('has no front blocker: every room from 1 x 1 up has a front wall', () => {
    const c = { ...withDesksAndStudents(1, 1), grid: { columns: 1, rows: 1 }, desks: [{ id: 'd', cell: { column: 0, row: 0 } }] }
    expect(runBlockers(c)).toEqual([])
  })

  it('is empty for a runnable room, with zero rules', () => {
    expect(runBlockers(withDesksAndStudents(2, 2))).toEqual([])
  })

  it('reports an orphaned rule', () => {
    const c = {
      ...withDesksAndStudents(1, 1),
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
  it("counts replaced desks and skips the teacher's desk cell", () => {
    const c: Classroom = {
      ...withDesksAndStudents(2, 0),
      teacherDesk: { id: 't', cell: { column: 2, row: 0 } },
    }
    const p = previewFill(c, { columns: 3, rows: 1, aisle: false })
    expect(p).toMatchObject({ ok: true, replaced: 2, skippedTeacherDesk: true, totalDesks: 2 })
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
    expect(MAX_DOORS).toBe(3)
    expect(MAX_TEACHER_DESKS).toBe(1)
    expect(limitMessage('desks')).toBe('Room is full (50 desks).')
  })
})
