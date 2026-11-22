import { runBlockers, type Blocker } from '../model/blockers'
import type { Classroom } from '../model/types'
import { blockerText, plural } from './text'

export type FixTarget = 'students' | 'rules' | 'canvas'

interface Line {
  readonly ok: boolean
  readonly text: string
  readonly target: FixTarget
}

export function checklistLines(classroom: Classroom): Line[] {
  const blockers = runBlockers(classroom)
  const find = <K extends Blocker['kind']>(kind: K) => blockers.find((b) => b.kind === kind)
  const mismatch = find('countMismatch')
  const ruleProblems = blockers.filter((b) => b.kind === 'ruleError').length
  const front = find('noFrontMarker') ?? find('frontMarkerNotOnEdge')
  const students = classroom.students.length
  const desks = classroom.desks.length
  return [
    {
      ok: !mismatch,
      text: mismatch ? blockerText(mismatch) : `${plural(desks, 'desk')} and ${plural(students, 'student')} match.`,
      target: 'students',
    },
    { ok: !find('noStudents'), text: find('noStudents') ? 'Add at least 1 student.' : 'At least 1 student.', target: 'students' },
    { ok: !front, text: front ? blockerText(front) : 'Front of room is marked.', target: 'canvas' },
    {
      ok: ruleProblems === 0,
      text: ruleProblems === 0 ? 'Rules are valid.' : `${plural(ruleProblems, 'rule')} ${ruleProblems === 1 ? 'needs' : 'need'} attention.`,
      target: 'rules',
    },
  ]
}

export function ReadinessChecklist({ classroom, onFix }: { classroom: Classroom; onFix: (target: FixTarget) => void }) {
  return (
    <ul className="checklist" aria-label="Run checklist">
      {checklistLines(classroom).map((line) => (
        <li key={line.text} className={line.ok ? 'ok' : 'todo'}>
          <span aria-hidden="true">{line.ok ? '✓' : '⚠'}</span>
          <span>{line.text}</span>
          {!line.ok && (
            <button type="button" className="link" onClick={() => onFix(line.target)}>
              Fix
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
