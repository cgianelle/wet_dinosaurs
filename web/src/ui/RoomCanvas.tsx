import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { wallRoles } from '../model/geometry'
import type { Classroom, Wall } from '../model/types'
import { useApp } from './AppContext'
import { ITEM_NAMES, movementOf, placementOf, removalOf, type Tool } from './canvasCommands'
import { DistanceLine } from './DistanceLine'
import { SlotView, type Mark } from './SlotView'
import {
  ARROWS,
  WALL_POSITION,
  WALL_TITLES,
  allSlots,
  clampSlot,
  itemAt,
  sameSlot,
  slotFromEvent,
  slotKey,
  toSlot,
  toXY,
  type Item,
  type Slot,
} from './slots'
import { wallLabel } from './text'
import { usePaintStroke } from './usePaintStroke'

/** A placed item, or a wall, picked out in the editor. */
export type Selection =
  | { readonly kind: 'desk' | 'teacherDesk' | 'door'; readonly id: string }
  | { readonly kind: 'wall'; readonly wall: Wall }

export interface DeskInfo {
  readonly name: string
  readonly mark: Mark
  readonly label: string
}

interface EditProps {
  readonly mode: 'edit'
  readonly classroom: Classroom
  readonly tool: Tool | null
  readonly selection: Selection | null
  /** Chosen with the selection strip's Move: the next valid spot clicked is its destination. */
  readonly moving: Selection | null
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

const labelPlacement = (wall: Wall, columns: number, rows: number): CSSProperties => {
  switch (wall) {
    case 'top':
      return { gridColumn: `2 / span ${columns}`, gridRow: 1 }
    case 'bottom':
      return { gridColumn: `2 / span ${columns}`, gridRow: rows + 2 }
    case 'left':
      return { gridColumn: 1, gridRow: `2 / span ${rows}` }
    case 'right':
      return { gridColumn: columns + 2, gridRow: `2 / span ${rows}` }
  }
}

/** The room as a grid inside four wall bands, shared by Plan (editable) and Results (read-only). */
export function RoomCanvas(props: RoomCanvasProps) {
  const { classroom } = props
  const { grid, frontWall } = classroom
  const app = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState<Slot>({ kind: 'cell', cell: { column: 0, row: 0 } })
  const [held, setHeld] = useState<{ item: Item; from: Slot } | null>(null)

  const edit = props.mode === 'edit' ? props : null
  const readonly = props.mode === 'readonly' ? props : null
  const interactive = edit !== null && !app.locked
  const roles = wallRoles(frontWall)
  const focusSlot = useMemo(() => clampSlot(grid, focus), [focus, grid])
  const focusKey = slotKey(focusSlot)

  useEffect(() => {
    const container = containerRef.current
    if (!container?.contains(document.activeElement)) return
    container.querySelector<HTMLElement>(`[data-slot="${focusKey}"]`)?.focus()
  }, [focusKey])

  const notify = app.notify

  const describe = (slot: Slot): string => {
    if (slot.kind === 'cell') {
      const position = `Screen row ${slot.cell.row + 1}, column ${slot.cell.column + 1}`
      const item = itemAt(classroom, slot)
      if (!item) return `${position}, empty`
      if (item.kind === 'teacherDesk') return `${position}, Teacher's desk`
      return readonly ? `${position}: ${readonly.deskInfo.get(item.id)?.label ?? 'desk'}` : `${position}, desk`
    }
    const base = `${WALL_TITLES[slot.wall]}, ${WALL_POSITION[slot.wall](slot.index)}, ${wallLabel(frontWall, slot.wall)}`
    const door = classroom.doors.findIndex((d) => d.wall === slot.wall && d.index === slot.index)
    if (door < 0) return base
    return `${base}, ${classroom.doors.length > 1 ? `Door ${door + 1}` : 'Door'}`
  }

  const move = useCallback(
    (what: Item, to: Slot) => {
      const command = movementOf(what, to)
      if (typeof command === 'string') notify(command)
      else app.dispatchCommand(command)
    },
    [app, notify],
  )

  const place = useCallback(
    (slot: Slot, tool: Tool) => {
      const command = placementOf(tool, slot)
      if (typeof command === 'string') notify(command)
      else app.dispatchCommand(command)
    },
    [app, notify],
  )

  /** Shared by keyboard and pointer: drops the item chosen with Move onto a free spot. */
  const completeMove = (edit: EditProps, slot: Slot, item: Item | null): boolean => {
    if (!edit.moving || item || edit.moving.kind === 'wall') return false
    move(edit.moving, slot)
    edit.onMoved()
    return true
  }

  /** Shared by keyboard and pointer: an empty spot takes the active tool, else selects the wall or clears. */
  const actOnEmptySlot = (edit: EditProps, slot: Slot) => {
    if (edit.tool) place(slot, edit.tool)
    else edit.onSelect(slot.kind === 'wall' ? { kind: 'wall', wall: slot.wall } : null)
  }

  const activate = (slot: Slot) => {
    if (!edit) return
    const item = itemAt(classroom, slot)
    if (held) {
      setHeld(null)
      if (!sameSlot(held.from, slot)) move(held.item, slot)
      return
    }
    if (completeMove(edit, slot, item)) return
    if (item) {
      edit.onSelect(item)
      setHeld({ item, from: slot })
      const where =
        slot.kind === 'cell'
          ? `screen row ${slot.cell.row + 1}, column ${slot.cell.column + 1}`
          : `the ${slot.wall} wall, ${WALL_POSITION[slot.wall](slot.index)}`
      app.announce(`${ITEM_NAMES[item.kind]} picked up from ${where}. Use arrow keys to choose a spot, Enter to drop, Escape to cancel.`)
    } else {
      actOnEmptySlot(edit, slot)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = ARROWS[event.key]
    if (step) {
      event.preventDefault()
      const { x, y } = toXY(grid, focusSlot)
      const next = toSlot(grid, x + step.x, y + step.y)
      if (next && (edit || next.kind === 'cell')) setFocus(next)
      return
    }
    if (readonly) {
      const item = itemAt(classroom, focusSlot)
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        readonly.onSelectDesk(item?.kind === 'desk' ? item.id : null)
      } else if (event.key === 'Escape') readonly.onSelectDesk(null)
      return
    }
    if (!edit || !interactive) return
    if (event.key === 'Escape') {
      if (held) {
        setFocus(held.from)
        setHeld(null)
        app.announce('Move cancelled.')
      } else edit.onSelect(null)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(focusSlot)
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      const item = itemAt(classroom, focusSlot)
      if (!item) return
      event.preventDefault()
      app.dispatchCommand(removalOf(item))
    }
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const slot = slotFromEvent(event.target)
    if (!slot) return
    setFocus(slot)
    const item = itemAt(classroom, slot)
    if (readonly) return readonly.onSelectDesk(item?.kind === 'desk' ? item.id : null)
    if (!edit || !interactive) return
    if (completeMove(edit, slot, item)) return
    if (item) edit.onSelect(item)
    else if (edit.tool === 'desk' && slot.kind === 'cell') return // painted by the pointer stroke
    else actOnEmptySlot(edit, slot)
  }

  const paint = usePaintStroke({
    classroom,
    enabled: edit !== null && interactive && edit.tool === 'desk',
    placeDesk: (slot) => place(slot, 'desk'),
    notify,
  })

  return (
    <div className="canvas-region">
      <div
        ref={containerRef}
        className={`room-ring front-${frontWall}${readonly ? ' is-readonly' : ''}${app.locked ? ' is-locked' : ''}`}
        style={{ '--columns': grid.columns, '--rows': grid.rows } as CSSProperties}
        role="grid"
        aria-label={readonly ? 'Seating plan' : 'Room'}
        aria-rowcount={grid.rows}
        aria-colcount={grid.columns}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          const slot = slotFromEvent(event.target)
          if (slot && (edit || slot.kind === 'cell')) setFocus(slot)
        }}
        onClick={handleClick}
        onPointerDown={paint.onPointerDown}
        onPointerOver={paint.onPointerOver}
      >
        {(['top', 'bottom', 'left', 'right'] as const).map((wall) => (
          <div
            key={wall}
            className={`wall-label wall-label-${wall} band-${roles[wall]}`}
            style={labelPlacement(wall, grid.columns, grid.rows)}
            aria-hidden="true"
          >
            <span>{wallLabel(frontWall, wall)}</span>
          </div>
        ))}
        {allSlots(grid).map((slot) => {
          const item = itemAt(classroom, slot)
          const deskId = item?.kind === 'desk' ? item.id : null
          const info = deskId ? readonly?.deskInfo.get(deskId) : undefined
          const inRule = deskId !== null && readonly?.highlighted?.has(deskId) === true
          const isCell = slot.kind === 'cell'
          const text = !item ? '' : item.kind === 'door' ? 'Door' : item.kind === 'teacherDesk' ? "Teacher's desk" : readonly ? (info?.name ?? '') : 'Desk'
          const itemSelected = item !== null && (edit ? isSameItem(edit.selection, item) : readonly?.selectedDeskId === item.id)
          const wallSelected = edit?.selection?.kind === 'wall' && slot.kind === 'wall' && edit.selection.wall === slot.wall && !item
          const selected = itemSelected || wallSelected
          return (
            <SlotView
              key={slotKey(slot)}
              slot={slot}
              item={item}
              doorNumber={item?.kind === 'door' && classroom.doors.length > 1 ? classroom.doors.findIndex((d) => d.id === item.id) + 1 : 0}
              text={text}
              ariaLabel={describe(slot)}
              focusable={slotKey(slot) === focusKey}
              selected={selected}
              held={held !== null && sameSlot(held.from, slot)}
              interactive={interactive}
              dim={Boolean(readonly?.highlighted) && deskId !== null && !inRule}
              mark={info?.mark ?? null}
              emphasised={inRule}
              toolActive={edit !== null && (edit.tool !== null || edit.moving !== null)}
              band={isCell ? null : roles[slot.wall]}
              columns={grid.columns}
              rows={grid.rows}
            />
          )
        })}
        {readonly?.line && <DistanceLine classroom={classroom} line={readonly.line} />}
      </div>
    </div>
  )
}

function isSameItem(selection: Selection | null, item: Item): boolean {
  return selection !== null && selection.kind !== 'wall' && selection.kind === item.kind && selection.id === item.id
}
