import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { hasValidFrontCell } from '../model/geometry'
import { MARKER_LIMITS, MAX_DESKS, limitMessage } from '../model/limits'
import { markerCount } from '../model/classroom'
import { MARKER_KINDS, type Classroom, type MarkerKind } from '../model/types'
import { useApp } from './AppContext'
import { ConfirmDialog, FillRoomDialog } from './dialogs'
import { MARKER_LABELS } from './text'
import type { Tool } from './RoomCanvas'

interface ToolButtonProps {
  readonly tool: Tool
  readonly label: string
  readonly detail?: string
  readonly unavailable: string | null
  readonly active: boolean
  readonly onToggle: (tool: Tool) => void
  readonly required?: boolean
}

function ToolButton({ tool, label, detail, unavailable, active, onToggle, required }: ToolButtonProps) {
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
        {required && <span className="required">Required</span>}
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
  const hasContent = classroom.desks.length + classroom.markers.length + classroom.students.length + classroom.rules.length > 0
  const markerReason = (kind: MarkerKind): string | null => {
    if (kind === 'front' && !hasValidFrontCell(classroom.grid)) {
      return 'This room has no valid spot for the Front marker. Make it at least 3 wide or 3 tall.'
    }
    return markerCount(classroom, kind) >= MARKER_LIMITS[kind] && kind !== 'front' ? 'Already placed. Move or remove it.' : null
  }

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
      <h2>Room markers</h2>
      <ul className="tools">
        {MARKER_KINDS.map((kind) => (
          <ToolButton
            key={kind}
            tool={kind}
            label={MARKER_LABELS[kind]}
            required={kind === 'front'}
            detail={`${markerCount(classroom, kind)} of ${MARKER_LIMITS[kind]}`}
            unavailable={markerReason(kind)}
            active={tool === kind}
            onToggle={toggle}
          />
        ))}
      </ul>
      <p className="hint">Drag a tool onto the grid, or select it and click a cell. Drag an item here to remove it.</p>
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
