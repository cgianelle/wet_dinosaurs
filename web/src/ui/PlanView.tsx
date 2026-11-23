import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { canUndo } from '../model/history'
import type { Classroom } from '../model/types'
import { useApp } from './AppContext'
import { Palette } from './Palette'
import { ReadinessChecklist, type FixTarget } from './ReadinessChecklist'
import { dropOutcome, removalOf, type Tool } from './canvasCommands'
import { RoomCanvas, type Selection } from './RoomCanvas'
import type { Item } from './slots'
import { RoomSizeBar } from './RoomSizeBar'
import { RulesPanel } from './RulesPanel'
import { StudentsPanel } from './StudentsPanel'
import { WALL_NAMES, failureDetails, failureMessage, plural, wallLabel } from './text'

type PanelTab = 'students' | 'rules'

const REMOVAL_LABELS = new Set(['remove desk', "remove teacher's desk", 'remove door', 'remove student', 'remove rule', 'start over'])

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
  }, [focusTarget])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || app.locked) return
    const result = dropOutcome(String(active.id), String(over.id))
    if (typeof result === 'string') app.notify(result)
    else if (result) app.dispatchCommand(result)
  }

  const changeTool = (next: Tool | null) => {
    setTool(next)
    setMoving(null)
  }

  const showHint = classroom.desks.length === 0 && classroom.doors.length === 0 && !classroom.teacherDesk
  const lastWasRemoval =
    editor.feedback?.kind === 'accepted' && REMOVAL_LABELS.has(editor.feedback.label) && canUndo(editor)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragCancel={() => setDragging(null)}
      onDragEnd={(e) => {
        setDragging(null)
        onDragEnd(e)
      }}
    >
      <div className="plan-layout">
        <Palette classroom={classroom} tool={tool} onTool={changeTool} />
        <main className="plan-center" ref={canvasRef}>
          <h2 className="sr-only">Plan</h2>
          {run.phase === 'failed' && <FailureBanner />}
          <RoomSizeBar classroom={classroom} />
          {showHint && (
            <p className="hint onboarding">
              Drag a Desk onto the grid, or click Desk and then click a cell. The blue wall is the front of the room (where your board is). Click another wall to change it.
            </p>
          )}
          <div className="canvas-wrap">
            <RoomCanvas
              mode="edit"
              classroom={classroom}
              tool={tool}
              selection={selection}
              moving={moving}
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
            <ReadinessChecklist classroom={classroom} onFix={(target) => setTab(target)} />
          </section>
        </aside>
      </div>
      <DragOverlay>{dragging ? <div className="drag-ghost">{ghostLabel(dragging)}</div> : null}</DragOverlay>
    </DndContext>
  )
}

function ghostLabel(dragId: string): string {
  const [kind, id] = dragId.split(/:(.*)/s)
  if (kind === 'tool') return id === 'door' ? 'Door' : id === 'teacherDesk' ? "Teacher's desk" : 'Desk'
  return kind === 'door' ? 'Door' : kind === 'teacherDesk' ? "Teacher's desk" : 'Desk'
}

function describeSelection(classroom: Classroom, selection: Selection): { label: string; position: string; item: Item | null } | null {
  if (selection.kind === 'wall') {
    return { label: `${WALL_NAMES[selection.wall][0]?.toUpperCase()}${WALL_NAMES[selection.wall].slice(1)} wall (${wallLabel(classroom.frontWall, selection.wall)})`, position: '', item: null }
  }
  if (selection.kind === 'door') {
    const door = classroom.doors.find((d) => d.id === selection.id)
    if (!door) return null
    const along = door.wall === 'top' || door.wall === 'bottom' ? `screen column ${door.index + 1}` : `screen row ${door.index + 1}`
    return { label: 'Door', position: `on the ${door.wall} wall, ${along}`, item: selection }
  }
  const placed = selection.kind === 'desk' ? classroom.desks.find((d) => d.id === selection.id) : classroom.teacherDesk
  if (!placed || placed.id !== selection.id) return null
  return {
    label: selection.kind === 'desk' ? 'Desk' : "Teacher's desk",
    position: `at screen row ${placed.cell.row + 1}, column ${placed.cell.column + 1}`,
    item: selection,
  }
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
  const described = selection ? describeSelection(classroom, selection) : null
  if (!selection || !described) return <p className="strip">Select a desk, door, teacher's desk or wall to remove, move or change it.</p>
  const { item } = described
  return (
    <p className="strip" role="group" aria-label="Selected item">
      <span>
        {props.moving
          ? `Click ${selection.kind === 'door' ? 'a free spot on a wall' : 'an empty cell'} to move the ${described.label.toLowerCase()}.`
          : `${described.label} ${described.position}`.trim()}
      </span>
      {item && (
        <>
          <button type="button" disabled={app.locked} onClick={props.onMove}>
            Move
          </button>
          <button
            type="button"
            disabled={app.locked}
            onClick={() => {
              app.dispatchCommand(removalOf(item))
              props.onClear()
            }}
          >
            Remove
          </button>
        </>
      )}
      {selection.kind === 'wall' && selection.wall !== classroom.frontWall && (
        <button type="button" disabled={app.locked} onClick={() => app.dispatchCommand({ type: 'setFrontWall', wall: selection.wall })}>
          Make this the front wall
        </button>
      )}
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
      <p>Your room, students and rules are still here.</p>
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
        <p>{failureDetails(run.failure)}</p>
      </details>
    </div>
  )
}
