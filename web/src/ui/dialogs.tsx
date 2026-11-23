import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { previewFill, previewPasteList } from '../model/bulk'
import type { Classroom } from '../model/types'
import { MAX_DESKS, MAX_STUDENTS } from '../model/limits'
import { useApp } from './AppContext'
import { newId } from './ids'
import { plural } from './text'

/** A modal dialog on the native <dialog>: focus trap, Esc to close, focus returned to the invoker. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    const invoker = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    return () => {
      dialog?.close?.()
      invoker?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}

export function ConfirmDialog(props: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <p>{props.message}</p>
      <div className="dialog-actions">
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" className="primary" onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function FillRoomDialog({ classroom, onClose }: { classroom: Classroom; onClose: () => void }) {
  const app = useApp()
  const [columns, setColumns] = useState(Math.min(classroom.grid.columns, 6))
  const [rows, setRows] = useState(Math.min(classroom.grid.rows, 5))
  const [aisle, setAisle] = useState(false)
  const preview = previewFill(classroom, { columns, rows, aisle })

  let status: string
  if (preview.ok) {
    status = `This places ${plural(preview.cells.length, 'desk')}.`
    if (preview.replaced > 0) status += ` This replaces ${plural(preview.replaced, 'existing desk')}.`
    if (preview.skippedTeacherDesk) status += " The teacher's desk cell is skipped."
  } else if (preview.problem === 'deskLimit') {
    status = `That would be ${preview.totalDesks} desks. Room is full at ${MAX_DESKS} desks. Reduce columns or rows.`
  } else if (preview.problem === 'doesNotFit') {
    status = `That block does not fit in a ${classroom.grid.columns} by ${classroom.grid.rows} room. Reduce columns or rows, or make the room bigger.`
  } else {
    status = 'Enter a whole number of columns and rows.'
  }

  const submit = () => {
    if (!preview.ok) return
    const ids = Array.from({ length: preview.cells.length }, newId)
    app.dispatchCommand({ type: 'fillRoom', columns, rows, aisle, ids })
    onClose()
  }

  return (
    <Modal title="Fill room" onClose={onClose}>
      <p>Place a block of desks starting at the top-left of the room.</p>
      <label>
        Columns of desks
        <input type="number" min={1} value={columns} onChange={(e) => setColumns(Number(e.target.value))} />
      </label>
      <label>
        Rows of desks
        <input type="number" min={1} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
      </label>
      <label className="check">
        <input type="checkbox" checked={aisle} onChange={(e) => setAisle(e.target.checked)} />
        Leave a center aisle
      </label>
      <p role="status" className={preview.ok ? '' : 'problem'}>
        {status}
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" aria-disabled={!preview.ok} onClick={submit}>
          Fill room
        </button>
      </div>
    </Modal>
  )
}

export function PasteListDialog({ classroom, onClose }: { classroom: Classroom; onClose: () => void }) {
  const app = useApp()
  const [text, setText] = useState('')
  const preview = previewPasteList(classroom, text)
  const blocked = preview.overLimitBy > 0
  const canAdd = preview.ready.length > 0 && !blocked

  const lines = [`${plural(preview.ready.length, 'name')} ready.`]
  if (preview.duplicates.length > 0) lines.push(`${plural(preview.duplicates.length, 'duplicate')} skipped: ${preview.duplicates.join(', ')}.`)
  if (preview.tooLong.length > 0) lines.push(`${plural(preview.tooLong.length, 'name')} skipped for being too long.`)
  const summary = blocked
    ? `That would be ${preview.totalAfter} students. The limit is ${MAX_STUDENTS}. Remove ${preview.overLimitBy} ${preview.overLimitBy === 1 ? 'name' : 'names'} or remove students first.`
    : lines.join(' ')

  const submit = () => {
    if (!canAdd) return
    app.dispatchCommand({ type: 'addStudents', students: preview.ready.map((name) => ({ id: newId(), name })) })
    onClose()
  }

  return (
    <Modal title="Paste a list" onClose={onClose}>
      <label>
        One name per line
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <p role="status" className={blocked ? 'problem' : ''}>
        {summary}
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary" aria-disabled={!canAdd} onClick={submit}>
          {`Add ${plural(preview.ready.length, 'student')}`}
        </button>
      </div>
    </Modal>
  )
}
