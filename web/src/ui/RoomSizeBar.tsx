import { useState } from 'react'
import { resizeLoss } from '../model/classroom'
import { MAX_COLUMNS, MAX_DESKS, MAX_ROWS, limitMessage } from '../model/limits'
import type { Classroom } from '../model/types'
import { useApp } from './AppContext'
import { ConfirmDialog } from './dialogs'
import { MARKER_LABELS, plural } from './text'

function SizeField(props: { label: string; value: number; max: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (raw: string) => {
    setDraft(null)
    const value = Number(raw)
    if (Number.isFinite(value) && raw.trim() !== '') props.onCommit(Math.round(value))
  }
  return (
    <div className="size-field">
      <label>
        {props.label}
        <input
          type="number"
          min={1}
          max={props.max}
          value={draft ?? String(props.value)}
          disabled={props.disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => draft !== null && commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
        />
      </label>
      <button type="button" aria-label={`Fewer ${props.label.toLowerCase()}`} disabled={props.disabled} onClick={() => props.onCommit(props.value - 1)}>
        {'−'}
      </button>
      <button type="button" aria-label={`More ${props.label.toLowerCase()}`} disabled={props.disabled} onClick={() => props.onCommit(props.value + 1)}>
        +
      </button>
    </div>
  )
}

export function RoomSizeBar({ classroom }: { classroom: Classroom }) {
  const app = useApp()
  const { columns, rows } = classroom.grid
  const [pending, setPending] = useState<{ columns: number; rows: number } | null>(null)
  const [clampNote, setClampNote] = useState('')

  const resize = (next: { columns: number; rows: number }) => {
    const clamped = {
      columns: Math.max(1, Math.min(MAX_COLUMNS, next.columns)),
      rows: Math.max(1, Math.min(MAX_ROWS, next.rows)),
    }
    setClampNote(
      next.columns > MAX_COLUMNS ? limitMessage('grid.columns') : next.rows > MAX_ROWS ? limitMessage('grid.rows') : '',
    )
    if (clamped.columns === columns && clamped.rows === rows) return
    const lost = resizeLoss(classroom, clamped.columns, clamped.rows)
    if (lost.desks.length > 0 || lost.markers.length > 0) setPending(clamped)
    else app.dispatchCommand({ type: 'resizeGrid', ...clamped })
  }

  const lost = pending ? resizeLoss(classroom, pending.columns, pending.rows) : null
  const lostParts = lost
    ? [
        lost.desks.length > 0 ? plural(lost.desks.length, 'desk') : '',
        ...lost.markers.map((m) => `the ${MARKER_LABELS[m.kind]} marker`),
      ].filter(Boolean)
    : []

  return (
    <div className="size-bar">
      <SizeField label="Columns" value={columns} max={MAX_COLUMNS} disabled={app.locked} onCommit={(v) => resize({ columns: v, rows })} />
      <SizeField label="Rows" value={rows} max={MAX_ROWS} disabled={app.locked} onCommit={(v) => resize({ columns, rows: v })} />
      <p className="desk-count">{`${classroom.desks.length} of ${MAX_DESKS} desks`}</p>
      {clampNote && <p className="problem" role="status">{clampNote}</p>}
      {pending && (
        <ConfirmDialog
          title="Shrink room?"
          message={`Making the room ${pending.columns} by ${pending.rows} deletes ${lostParts.join(' and ')}. You can undo this.`}
          confirmLabel="Shrink room"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            app.dispatchCommand({ type: 'resizeGrid', ...pending, confirmed: true })
            setPending(null)
          }}
        />
      )}
    </div>
  )
}
