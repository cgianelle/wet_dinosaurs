import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { frontEdgeOf, occupantOf, sameCell } from '../model/geometry'
import type { Cell, Classroom, MarkerKind } from '../model/types'
import { useApp } from './AppContext'
import { newId } from './ids'
import { MARKER_LABELS } from './text'

export type Tool = 'desk' | MarkerKind

/** A desk or marker picked out in the editor. */
export interface Selection {
  readonly kind: 'desk' | 'marker'
  readonly id: string
}

export interface DeskInfo {
  readonly name: string
  readonly mark: 'notMet' | 'neutral' | null
  readonly label: string
}

type Mark = DeskInfo['mark']

const MARKER_ICONS: Readonly<Record<MarkerKind, string>> = {
  front: '▲',
  back: '▼',
  side: '◀',
  door: '▯',
  teacherDesk: '★',
}

interface EditProps {
  readonly mode: 'edit'
  readonly classroom: Classroom
  readonly tool: Tool | null
  readonly selection: Selection | null
  /** Chosen with the selection strip's Move: the next empty cell clicked is its destination. */
  readonly moving: Selection | null
  /** The dnd-kit id being dragged, if any; used to show where Front may be dropped. */
  readonly dragging: string | null
  readonly onSelect: (selection: Selection | null) => void
  readonly onMoved: () => void
}

interface ReadonlyProps {
  readonly mode: 'readonly'
  readonly classroom: Classroom
  readonly deskInfo: ReadonlyMap<string, DeskInfo>
  /** Desks involved in the selected rule; everything else dims. Null when no rule is selected. */
  readonly highlighted: ReadonlySet<string> | null
  readonly selectedDeskId: string | null
  readonly line: { readonly from: string; readonly to: string; readonly label: string } | null
  readonly onSelectDesk: (deskId: string | null) => void
}

export type RoomCanvasProps = EditProps | ReadonlyProps

type Item = { readonly kind: 'desk'; readonly id: string } | { readonly kind: 'marker'; readonly id: string; readonly marker: MarkerKind }

function itemAt(classroom: Classroom, cell: Cell): Item | null {
  const occupant = occupantOf(classroom, cell)
  if (!occupant) return null
  return occupant.kind === 'desk' ? { kind: 'desk', id: occupant.id } : { kind: 'marker', id: occupant.id, marker: occupant.kind }
}

function cellFromEvent(target: EventTarget | null): Cell | null {
  const value = (target as HTMLElement | null)?.closest?.('[data-cell]')?.getAttribute('data-cell')
  const [column, row] = (value ?? '').split(',').map(Number)
  return column === undefined || row === undefined || Number.isNaN(column) || Number.isNaN(row) ? null : { column, row }
}

interface CellViewProps {
  readonly column: number
  readonly row: number
  readonly item: Item | null
  readonly text: string
  readonly ariaLabel: string
  readonly focusable: boolean
  readonly selected: boolean
  readonly held: boolean
  readonly target: 'valid' | 'invalid' | null
  readonly interactive: boolean
  readonly dim: boolean
  readonly mark: Mark
  readonly emphasised: boolean
  readonly toolActive: boolean
}

/** Memoized so a drag over 50 desks re-renders only the cells whose props changed (NFR). */
const CellView = memo(function CellView(props: CellViewProps) {
  const { column, row, item } = props
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${column},${row}`, disabled: !props.interactive })
  const classes = [
    'cell',
    !item && 'cell-empty',
    item?.kind === 'desk' && 'cell-desk',
    item?.kind === 'marker' && `cell-marker marker-${item.marker}`,
    props.selected && 'is-selected',
    props.held && 'is-held',
    props.dim && 'is-dim',
    props.emphasised && 'is-emphasised',
    props.mark && `mark-${props.mark}`,
    props.toolActive && !item && 'tool-active',
    isOver && props.target !== 'invalid' && 'is-over',
    props.target === 'invalid' && 'is-blocked',
    props.target === 'valid' && 'is-valid-target',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={classes}
      data-cell={`${column},${row}`}
      tabIndex={props.focusable ? 0 : -1}
      aria-label={props.ariaLabel}
      aria-selected={props.selected}
    >
      {item && props.interactive ? <DraggableFace item={item} text={props.text} /> : <Face item={item} text={props.text} mark={props.mark} />}
    </div>
  )
})

function DraggableFace({ item, text }: { item: Item; text: string }) {
  const { setNodeRef, listeners } = useDraggable({ id: `${item.kind}:${item.id}` })
  return (
    <div ref={setNodeRef} className="item-drag" {...listeners}>
      <Face item={item} text={text} mark={null} />
    </div>
  )
}

function Face({ item, text, mark }: { item: Item | null; text: string; mark: Mark }) {
  if (!item) return null
  return (
    <span className="item-face" aria-hidden="true">
      {item.kind === 'marker' && <span className="marker-icon">{MARKER_ICONS[item.marker]}</span>}
      <span className="item-text">{text}</span>
      {mark && <span className={`mark-badge mark-badge-${mark}`}>{mark === 'notMet' ? '⚠' : '–'}</span>}
    </span>
  )
}

const ARROWS: Readonly<Record<string, Cell>> = {
  ArrowUp: { column: 0, row: -1 },
  ArrowDown: { column: 0, row: 1 },
  ArrowLeft: { column: -1, row: 0 },
  ArrowRight: { column: 1, row: 0 },
}

/** The room as a grid, shared by Plan (editable) and Results (read-only) (UX section 12). */
export function RoomCanvas(props: RoomCanvasProps) {
  const { classroom } = props
  const { grid } = classroom
  const app = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<Cell>({ column: 0, row: 0 })
  const [held, setHeld] = useState<{ item: Item; from: Cell } | null>(null)
  const painting = useRef(false)

  const edit = props.mode === 'edit' ? props : null
  const interactive = edit !== null && !app.locked
  const front = classroom.markers.find((m) => m.kind === 'front')
  const frontEdge = front ? frontEdgeOf(grid, front.cell) : null
  const focusCell = useMemo(
    () => ({ column: Math.min(focus.column, grid.columns - 1), row: Math.min(focus.row, grid.rows - 1) }),
    [focus, grid.columns, grid.rows],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container?.contains(document.activeElement)) return
    container.querySelector<HTMLElement>(`[data-cell="${focusCell.column},${focusCell.row}"]`)?.focus()
  }, [focusCell])

  const place = useCallback(
    (cell: Cell, tool: Tool) =>
      app.dispatchCommand(tool === 'desk' ? { type: 'placeDesk', id: newId(), cell } : { type: 'placeMarker', id: newId(), kind: tool, cell }),
    [app],
  )

  const move = useCallback(
    (what: Selection, to: Cell) =>
      app.dispatchCommand(what.kind === 'desk' ? { type: 'moveDesk', id: what.id, to } : { type: 'moveMarker', id: what.id, to }),
    [app],
  )

  const describe = (cell: Cell): string => {
    const position = `Row ${cell.row + 1}, column ${cell.column + 1}`
    const item = itemAt(classroom, cell)
    if (!item) return `${position}, empty`
    if (item.kind === 'marker') {
      const edge = item.marker === 'front' ? frontEdgeOf(grid, cell) : null
      return `${position}, ${MARKER_LABELS[item.marker]} marker${edge ? `, ${edge} edge` : ''}`
    }
    return props.mode === 'readonly' ? `${position}: ${props.deskInfo.get(item.id)?.label ?? 'desk'}` : `${position}, desk`
  }

  const activate = (cell: Cell) => {
    if (!edit) return
    const item = itemAt(classroom, cell)
    if (held) {
      setHeld(null)
      if (!sameCell(held.from, cell)) move(held.item, cell)
      return
    }
    if (edit.moving && !item) {
      move(edit.moving, cell)
      edit.onMoved()
    } else if (item) {
      edit.onSelect({ kind: item.kind, id: item.id })
      setHeld({ item, from: cell })
      const what = item.kind === 'desk' ? 'Desk' : MARKER_LABELS[item.marker]
      app.announce(
        `${what} picked up from row ${cell.row + 1}, column ${cell.column + 1}. Use arrow keys to choose a cell, Enter to drop, Escape to cancel.`,
      )
    } else if (edit.tool) {
      place(cell, edit.tool)
    } else {
      edit.onSelect(null)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROWS[event.key]
    if (step) {
      event.preventDefault()
      setFocus({
        column: Math.max(0, Math.min(grid.columns - 1, focusCell.column + step.column)),
        row: Math.max(0, Math.min(grid.rows - 1, focusCell.row + step.row)),
      })
      return
    }
    if (props.mode === 'readonly') {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const item = itemAt(classroom, focusCell)
        props.onSelectDesk(item?.kind === 'desk' ? item.id : null)
      } else if (event.key === 'Escape') props.onSelectDesk(null)
      return
    }
    if (!interactive) return
    if (event.key === 'Escape') {
      if (held) {
        setFocus(held.from)
        setHeld(null)
        app.announce('Move cancelled.')
      } else props.onSelect(null)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(focusCell)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const item = itemAt(classroom, focusCell)
      if (!item) return
      event.preventDefault()
      app.dispatchCommand(item.kind === 'desk' ? { type: 'removeDesk', id: item.id } : { type: 'removeMarker', id: item.id })
    }
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const cell = cellFromEvent(event.target)
    if (!cell) return
    setFocus(cell)
    const item = itemAt(classroom, cell)
    if (props.mode === 'readonly') return props.onSelectDesk(item?.kind === 'desk' ? item.id : null)
    if (!edit || !interactive) return
    if (edit.moving && !item) {
      move(edit.moving, cell)
      edit.onMoved()
    } else if (item) edit.onSelect({ kind: item.kind, id: item.id })
    else if (edit.tool && edit.tool !== 'desk') place(cell, edit.tool)
    else if (!edit.tool) edit.onSelect(null)
  }

  // The Desk tool paints on press and drag; other tools place on click.
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!edit || !interactive || edit.tool !== 'desk' || event.button !== 0) return
    const cell = cellFromEvent(event.target)
    if (!cell || itemAt(classroom, cell)) return
    painting.current = true
    place(cell, 'desk')
    window.addEventListener('pointerup', () => (painting.current = false), { once: true })
  }

  const handlePointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (!painting.current) return
    const cell = cellFromEvent(event.target)
    if (cell && !itemAt(classroom, cell)) place(cell, 'desk')
  }

  const dragging = edit?.dragging ?? null
  const draggingFront = dragging === 'tool:front' || (dragging?.startsWith('marker:') === true && classroom.markers.some((m) => `marker:${m.id}` === dragging && m.kind === 'front'))
  const readonly = props.mode === 'readonly' ? props : null

  const cells: Cell[] = []
  for (let row = 0; row < grid.rows; row++) for (let column = 0; column < grid.columns; column++) cells.push({ column, row })

  return (
    <div className="canvas-region">
      <div className={`room-frame${frontEdge ? ` front-${frontEdge}` : ''}`} style={{ '--columns': grid.columns, '--rows': grid.rows } as CSSProperties}>
        {frontEdge && (
          <div className={`front-bar front-bar-${frontEdge}`} aria-hidden="true">
            <span>Front of room</span>
          </div>
        )}
        <div
          ref={containerRef}
          className={`room-grid${readonly ? ' is-readonly' : ''}${app.locked ? ' is-locked' : ''}`}
          role="grid"
          aria-label={readonly ? 'Seating plan' : 'Room'}
          aria-rowcount={grid.rows}
          aria-colcount={grid.columns}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
        >
          {cells.map((cell) => {
            const item = itemAt(classroom, cell)
            const info = item?.kind === 'desk' ? readonly?.deskInfo.get(item.id) : undefined
            const inRule = item?.kind === 'desk' && readonly?.highlighted?.has(item.id) === true
            const text = item?.kind === 'marker' ? MARKER_LABELS[item.marker] : item ? (readonly ? (info?.name ?? '') : 'Desk') : ''
            return (
              <CellView
                key={`${cell.column},${cell.row}`}
                column={cell.column}
                row={cell.row}
                item={item}
                text={text}
                ariaLabel={describe(cell)}
                focusable={sameCell(cell, focusCell)}
                selected={item !== null && (edit ? edit.selection?.id === item.id : readonly?.selectedDeskId === item.id)}
                held={held !== null && sameCell(held.from, cell)}
                target={draggingFront ? (frontEdgeOf(grid, cell) && !item ? 'valid' : 'invalid') : null}
                interactive={interactive}
                dim={Boolean(readonly?.highlighted) && item?.kind === 'desk' && !inRule}
                mark={info?.mark ?? null}
                emphasised={inRule}
                toolActive={edit !== null && (edit.tool !== null || edit.moving !== null)}
              />
            )
          })}
          {readonly?.line && <DistanceLine classroom={classroom} line={readonly.line} />}
        </div>
      </div>
    </div>
  )
}

function DistanceLine({ classroom, line }: { classroom: Classroom; line: { from: string; to: string; label: string } }) {
  const from = classroom.desks.find((d) => d.id === line.from)?.cell
  const to = classroom.desks.find((d) => d.id === line.to)?.cell
  if (!from || !to) return null
  const { columns, rows } = classroom.grid
  const centre = (cell: Cell) => ({ x: ((cell.column + 0.5) / columns) * 100, y: ((cell.row + 0.5) / rows) * 100 })
  const a = centre(from)
  const b = centre(to)
  return (
    <div className="distance-line" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="distance-label" style={{ left: `${(a.x + b.x) / 2}%`, top: `${(a.y + b.y) / 2}%` }}>
        {line.label}
      </span>
    </div>
  )
}
