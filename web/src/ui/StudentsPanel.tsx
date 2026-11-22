import { useMemo, useRef, useState, type FormEvent } from 'react'
import { MAX_NAME_LENGTH, MAX_STUDENTS, limitMessage } from '../model/limits'
import { checkName } from '../model/names'
import { ruleStudentIds } from '../model/rules'
import type { Classroom, Student } from '../model/types'
import { useApp } from './AppContext'
import { ConfirmDialog, PasteListDialog } from './dialogs'
import { newId } from './ids'
import { blockerText, nameProblemMessage, plural } from './text'
import { runBlockers } from '../model/blockers'

export function StudentsPanel({ classroom }: { classroom: Classroom }) {
  const app = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [pasting, setPasting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Student | null>(null)
  const [filter, setFilter] = useState('')
  const full = classroom.students.length >= MAX_STUDENTS

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (app.locked) return
    const check = checkName(name, classroom.students)
    if (!check.ok) {
      setError(nameProblemMessage(check.problem, name))
      inputRef.current?.focus()
      return
    }
    if (full) return setError(limitMessage('students'))
    app.dispatchCommand({ type: 'addStudent', id: newId(), name: check.name })
    setName('')
    setError('')
    inputRef.current?.focus()
  }

  const rulesOf = (id: string) => classroom.rules.filter((r) => ruleStudentIds(r).includes(id)).length
  const shown = useMemo(
    () => classroom.students.filter((s) => s.name.toLowerCase().includes(filter.trim().toLowerCase())),
    [classroom.students, filter],
  )
  const mismatch = runBlockers(classroom).find((b) => b.kind === 'countMismatch')

  const remove = (student: Student) => {
    if (rulesOf(student.id) > 0) setRemoving(student)
    else app.dispatchCommand({ type: 'removeStudent', id: student.id })
  }

  return (
    <section aria-labelledby="students-heading" className="panel-body">
      <h2 id="students-heading">
        Students <span className="count">{`${classroom.students.length} of ${MAX_STUDENTS}`}</span>
      </h2>
      <form onSubmit={add} className="add-student" noValidate>
        <label htmlFor="student-name">Student name</label>
        <div className="row">
          <input
            id="student-name"
            ref={inputRef}
            value={name}
            disabled={app.locked || full}
            aria-invalid={error !== ''}
            aria-describedby="student-help student-error"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary" disabled={app.locked || full}>
            Add
          </button>
        </div>
        <p id="student-help" className="help">
          {full ? limitMessage('students') : `Names appear exactly as you type them. ${[...name].length > 30 ? `${[...name].length} of ${MAX_NAME_LENGTH} characters.` : ''}`}
        </p>
        <p id="student-error" className="problem" role={error ? 'alert' : undefined}>
          {error}
        </p>
      </form>
      <button type="button" className="link" disabled={app.locked || full} onClick={() => setPasting(true)}>
        Paste a list
      </button>
      {classroom.students.length > 15 && (
        <label className="filter">
          Filter students
          <input value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      )}
      {classroom.students.length === 0 ? (
        <p className="empty">No students yet. Add names one at a time or paste a list.</p>
      ) : (
        <ul className="student-list">
          {shown.map((student) =>
            editing === student.id ? (
              <EditRow key={student.id} student={student} classroom={classroom} onDone={() => setEditing(null)} />
            ) : (
              <li key={student.id}>
                <span className="name">{student.name}</span>
                {rulesOf(student.id) > 0 && <span className="badge">{plural(rulesOf(student.id), 'rule')}</span>}
                <button type="button" disabled={app.locked} aria-label={`Edit ${student.name}`} onClick={() => setEditing(student.id)}>
                  Edit
                </button>
                <button type="button" disabled={app.locked} aria-label={`Remove ${student.name}`} onClick={() => remove(student)}>
                  Remove
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      <p className={`match${mismatch ? ' problem' : ''}`}>
        {mismatch ? `⚠ ${blockerText(mismatch)}` : `✓ ${plural(classroom.students.length, 'student')}, ${plural(classroom.desks.length, 'desk')}.`}
      </p>
      {pasting && <PasteListDialog classroom={classroom} onClose={() => setPasting(false)} />}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message={`This also removes ${plural(rulesOf(removing.id), 'rule')}. You can undo this.`}
          confirmLabel={`Remove student and ${plural(rulesOf(removing.id), 'rule')}`}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            app.dispatchCommand({ type: 'removeStudent', id: removing.id })
            setRemoving(null)
          }}
        />
      )}
    </section>
  )
}

function EditRow({ student, classroom, onDone }: { student: Student; classroom: Classroom; onDone: () => void }) {
  const app = useApp()
  const [value, setValue] = useState(student.name)
  const [error, setError] = useState('')
  const save = (event: FormEvent) => {
    event.preventDefault()
    const check = checkName(value, classroom.students, student.id)
    if (!check.ok) return setError(nameProblemMessage(check.problem, value))
    if (check.name !== student.name) app.dispatchCommand({ type: 'editStudent', id: student.id, name: check.name })
    onDone()
  }
  return (
    <li>
      <form onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && onDone()} className="edit-row">
        <label>
          {`New name for ${student.name}`}
          <input value={value} autoFocus aria-invalid={error !== ''} onChange={(e) => setValue(e.target.value)} />
        </label>
        <button type="submit" className="primary">
          Save
        </button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        {error && <p className="problem" role="alert">{error}</p>}
      </form>
    </li>
  )
}
