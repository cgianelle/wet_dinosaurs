import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { MAX_DESKS, MAX_DOORS, MAX_TEACHER_DESKS, limitMessage } from '../model/limits'
import type { Classroom } from '../model/types'
import { useApp } from './AppContext'
import { ConfirmDialog, FillRoomDialog } from './dialogs'
import type { Tool } from './canvasCommands'

interface ToolButtonProps {
  readonly tool: Tool
  readonly label: string
  readonly detail?: string
  readonly unavailable: string | null
  readonly active: boolean
  readonly onToggle: (tool: Tool) => void
}

function ToolButton({ tool, label, detail, unavailable, active, onToggle }: ToolButtonProps) {
  const app = useApp()
  const disabled = unavailable !== null || app.locked
  const { setNodeRef, listeners } = useDraggable({ id: `tool:${tool}`, disabled })
  const reasonId = `reason-${tool}`
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        className={`tool${active ? ' is-active' : ''}`}
        aria-pressed={active}
        aria-disabled={disabled}
        aria-describedby={unavailable ? reasonId : undefined}
        onClick={() => !disabled && onToggle(tool)}
        {...listeners}
      >
        <span>{label}</span>
        {detail && <span className="detail">{detail}</span>}
      </button>
      {unavailable && (
        <p id={reasonId} className="reason">
          {unavailable}
        </p>
      )}
    </li>
  )
}

export function Palette(props: { classroom: Classroom; tool: Tool | null; onTool: (tool: Tool | null) => void }) {
  const { classroom, tool, onTool } = props
  const app = useApp()
  const [filling, setFilling] = useState(false)
  const [confirmingStartOver, setConfirmingStartOver] = useState(false)
  const { setNodeRef, isOver } = useDroppable({ id: 'palette' })
  const toggle = (next: Tool) => onTool(tool === next ? null : next)
  const full = classroom.desks.length >= MAX_DESKS
  const placedTeacherDesks = classroom.teacherDesk ? 1 : 0
  const hasContent =
    classroom.desks.length + classroom.doors.length + placedTeacherDesks + classroom.students.length + classroom.rules.length > 0
  const ALREADY_PLACED = 'Already placed. Move or remove it.'

  return (
    <aside ref={setNodeRef} className={`palette${isOver ? ' is-over' : ''}`} aria-label="Room tools">
      <h2>Desks</h2>
      <ul className="tools">
        <ToolButton tool="desk" label="Desk" unavailable={full ? limitMessage('desks') : null} active={tool === 'desk'} onToggle={toggle} />
        <li>
          <button type="button" aria-disabled={full || app.locked} onClick={() => !full && !app.locked && setFilling(true)}>
            Fill room
          </button>
        </li>
      </ul>
      <h2>Room features</h2>
      <ul className="tools">
        <ToolButton
          tool="door"
          label="Door"
          detail={`${classroom.doors.length} of ${MAX_DOORS}`}
          unavailable={classroom.doors.length >= MAX_DOORS ? ALREADY_PLACED : null}
          active={tool === 'door'}
          onToggle={toggle}
        />
        <ToolButton
          tool="teacherDesk"
          label="Teacher's desk"
          detail={`${placedTeacherDesks} of ${MAX_TEACHER_DESKS}`}
          unavailable={placedTeacherDesks >= MAX_TEACHER_DESKS ? ALREADY_PLACED : null}
          active={tool === 'teacherDesk'}
          onToggle={toggle}
        />
      </ul>
      <p className="hint">Drag a tool onto the grid or a wall, or select it and click a cell or wall. Drag an item here to remove it. Walls are always there; click one to choose the front.</p>
      {hasContent && (
        <button type="button" className="quiet" disabled={app.locked} onClick={() => setConfirmingStartOver(true)}>
          Start over
        </button>
      )}
      {filling && <FillRoomDialog classroom={classroom} onClose={() => setFilling(false)} />}
      {confirmingStartOver && (
        <ConfirmDialog
          title="Start over?"
          message="This clears the room, students and rules, and any results."
          confirmLabel="Start over"
          onCancel={() => setConfirmingStartOver(false)}
          onConfirm={() => {
            app.dispatchCommand({ type: 'startOver' })
            setConfirmingStartOver(false)
          }}
        />
      )}
    </aside>
  )
}
