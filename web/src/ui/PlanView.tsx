import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { hasValidFrontCell } from '../model/geometry'
import { canUndo } from '../model/history'
import { frontMarker } from '../model/classroom'
import type { Classroom, MarkerKind } from '../model/types'
import { useApp } from './AppContext'
import { newId } from './ids'
import { Palette } from './Palette'
import { ReadinessChecklist, type FixTarget } from './ReadinessChecklist'
import { RoomCanvas, type Selection, type Tool } from './RoomCanvas'
import { RoomSizeBar } from './RoomSizeBar'
import { RulesPanel } from './RulesPanel'
import { StudentsPanel } from './StudentsPanel'
import { MARKER_LABELS, failureMessage, plural } from './text'

type PanelTab = 'students' | 'rules'

const REMOVAL_LABELS = new Set(['remove desk', 'remove marker', 'remove student', 'remove rule', 'start over'])

export function PlanView({ focusTarget }: { focusTarget: FixTarget | null }) {
  const app = useApp()
  const { editor, run } = app.state
  const classroom = editor.present
  const [tool, setTool] = useState<Tool | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [moving, setMoving] = useState<Selection | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [tab, setTab] = useState<PanelTab>('students')
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusTarget === 'students' || focusTarget === 'rules') setTab(focusTarget)
    if (focusTarget === 'canvas') canvasRef.current?.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')?.focus()
  }, [focusTarget])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    if (!over || app.locked) return
    const [kind, id] = String(active.id).split(/:(.*)/s)
    const target = String(over.id)
    if (target === 'palette') {
      if (kind === 'desk') app.dispatchCommand({ type: 'removeDesk', id: id ?? '' })
      if (kind === 'marker') app.dispatchCommand({ type: 'removeMarker', id: id ?? '' })
      return
    }
    const [columnText, rowText] = target.replace('cell:', '').split(',')
    const cell = { column: Number(columnText), row: Number(rowText) }
    if (kind === 'tool') {
      const dragged = id as Tool
      app.dispatchCommand(
        dragged === 'desk' ? { type: 'placeDesk', id: newId(), cell } : { type: 'placeMarker', id: newId(), kind: dragged, cell },
      )
    } else if (kind === 'desk') {
      const desk = classroom.desks.find((d) => d.id === id)
      if (desk && (desk.cell.column !== cell.column || desk.cell.row !== cell.row)) app.dispatchCommand({ type: 'moveDesk', id: id ?? '', to: cell })
    } else if (kind === 'marker') {
      const marker = classroom.markers.find((m) => m.id === id)
      if (marker && (marker.cell.column !== cell.column || marker.cell.row !== cell.row)) app.dispatchCommand({ type: 'moveMarker', id: id ?? '', to: cell })
    }
  }

  const changeTool = (next: Tool | null) => {
    setTool(next)
    setMoving(null)
  }

  const showHint = classroom.desks.length === 0 && classroom.markers.length === 0
  const missingFront = !frontMarker(classroom)
  const lastWasRemoval =
    editor.feedback?.kind === 'accepted' && REMOVAL_LABELS.has(editor.feedback.label) && canUndo(editor)

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(String(e.active.id))} onDragCancel={() => setDragging(null)} onDragEnd={onDragEnd}>
      <div className="plan-layout">
        <Palette classroom={classroom} tool={tool} onTool={changeTool} />
        <main className="plan-center" ref={canvasRef}>
          <h2 className="sr-only">Plan</h2>
          {run.phase === 'failed' && <FailureBanner />}
          <RoomSizeBar classroom={classroom} />
          {showHint && (
            <p className="hint onboarding">
              Drag a Desk onto the grid, or click Desk and then click a cell. Drag Front onto a cell on the edge of the room where your board is.
            </p>
          )}
          {missingFront && hasValidFrontCell(classroom.grid) && (
            <p className="notice">Place the Front marker on a cell at the edge of the room, where your board is.</p>
          )}
          {!hasValidFrontCell(classroom.grid) && (
            <p className="notice">This room has no valid spot for the Front marker. Make it at least 3 wide or 3 tall.</p>
          )}
          <div className="canvas-wrap">
            <RoomCanvas
              mode="edit"
              classroom={classroom}
              tool={tool}
              selection={selection}
              moving={moving}
              dragging={dragging}
              onSelect={(next) => {
                setSelection(next)
                setMoving(null)
              }}
              onMoved={() => {
                setMoving(null)
                setSelection(null)
              }}
            />
            {app.locked && <RunningPanel studentCount={classroom.students.length} />}
          </div>
          <p className="caption" aria-live="off">
            {app.caption}
            {lastWasRemoval && (
              <button type="button" className="link" onClick={app.undo}>
                Undo
              </button>
            )}
          </p>
          <SelectionStrip
            classroom={classroom}
            selection={selection}
            moving={moving}
            onMove={() => selection && setMoving(selection)}
            onClear={() => setSelection(null)}
          />
        </main>
        <aside className="plan-side" aria-label="Students and rules">
          <div role="tablist" aria-label="Students and rules" className="side-tabs">
            <button type="button" role="tab" aria-selected={tab === 'students'} onClick={() => setTab('students')}>
              {`Students (${classroom.students.length})`}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>
              {`Rules (${classroom.rules.length})`}
            </button>
          </div>
          {tab === 'students' ? <StudentsPanel classroom={classroom} /> : <RulesPanel classroom={classroom} />}
          <section className="run-checklist" aria-labelledby="checklist-heading">
            <h2 id="checklist-heading">Run checklist</h2>
            <ReadinessChecklist classroom={classroom} onFix={(target) => (target === 'canvas' ? setTool('front') : setTab(target))} />
          </section>
        </aside>
      </div>
      <DragOverlay>{dragging ? <div className="drag-ghost">{ghostLabel(dragging, classroom)}</div> : null}</DragOverlay>
    </DndContext>
  )
}

function ghostLabel(dragId: string, classroom: Classroom): string {
  const [kind, id] = dragId.split(/:(.*)/s)
  if (kind === 'tool') return id === 'desk' ? 'Desk' : MARKER_LABELS[id as MarkerKind]
  if (kind === 'marker') return MARKER_LABELS[classroom.markers.find((m) => m.id === id)?.kind ?? 'back']
  return 'Desk'
}

function SelectionStrip(props: {
  classroom: Classroom
  selection: Selection | null
  moving: Selection | null
  onMove: () => void
  onClear: () => void
}) {
  const app = useApp()
  const { classroom, selection } = props
  const desk = selection?.kind === 'desk' ? classroom.desks.find((d) => d.id === selection.id) : undefined
  const marker = selection?.kind === 'marker' ? classroom.markers.find((m) => m.id === selection.id) : undefined
  const item = desk ?? marker
  if (!selection || !item) return <p className="strip">Select a desk or marker to remove or move it.</p>
  const label = marker ? `${MARKER_LABELS[marker.kind]} marker` : 'Desk'
  const position = `row ${item.cell.row + 1}, column ${item.cell.column + 1}`
  return (
    <p className="strip" role="group" aria-label="Selected item">
      <span>{props.moving ? `Click an empty cell to move the ${label.toLowerCase()}.` : `${label} at ${position}`}</span>
      <button type="button" disabled={app.locked} onClick={props.onMove}>
        Move
      </button>
      <button
        type="button"
        disabled={app.locked}
        onClick={() => {
          app.dispatchCommand(selection.kind === 'desk' ? { type: 'removeDesk', id: selection.id } : { type: 'removeMarker', id: selection.id })
          props.onClear()
        }}
      >
        Remove
      </button>
    </p>
  )
}

function RunningPanel({ studentCount }: { studentCount: number }) {
  const app = useApp()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 10_000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div className="running-panel" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{`Finding the best seating plans for ${plural(studentCount, 'student')}...`}</p>
      {slow && <p>Larger rooms can take a bit longer.</p>}
      <button type="button" onClick={app.cancel} autoFocus>
        Cancel
      </button>
    </div>
  )
}

function FailureBanner() {
  const app = useApp()
  const { run } = app.state
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])
  if (run.phase !== 'failed') return null
  return (
    <div className="banner error" role="alert">
      <h2 ref={headingRef} tabIndex={-1}>
        Seating plans unavailable
      </h2>
      <p>{failureMessage(run.failure)}</p>
      <div className="row">
        <button type="button" className="primary" onClick={app.retry}>
          Try again
        </button>
        <button type="button" onClick={app.dismissRunProblem}>
          Dismiss
        </button>
      </div>
      <details>
        <summary>Show details</summary>
        <p>{run.failure.kind === 'rejected' ? `Error code: ${run.failure.code}` : `Error: ${run.failure.kind}`}</p>
      </details>
    </div>
  )
}
