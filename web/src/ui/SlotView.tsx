import { useDraggable, useDroppable } from '@dnd-kit/core'
import { memo, type CSSProperties } from 'react'
import { slotKey, type Item, type Slot } from './slots'

export type Mark = 'notMet' | 'neutral' | null

export interface SlotViewProps {
  readonly slot: Slot
  readonly item: Item | null
  readonly doorNumber: number
  readonly text: string
  readonly ariaLabel: string
  readonly focusable: boolean
  readonly selected: boolean
  readonly held: boolean
  readonly interactive: boolean
  readonly dim: boolean
  readonly mark: Mark
  readonly emphasised: boolean
  readonly toolActive: boolean
  readonly band: 'front' | 'back' | 'side' | null
}


const gridPlacement = (slot: Slot, columns: number, rows: number): CSSProperties => {
  if (slot.kind === 'cell') return { gridColumn: slot.cell.column + 2, gridRow: slot.cell.row + 2 }
  switch (slot.wall) {
    case 'top':
      return { gridColumn: slot.index + 2, gridRow: 1 }
    case 'bottom':
      return { gridColumn: slot.index + 2, gridRow: rows + 2 }
    case 'left':
      return { gridColumn: 1, gridRow: slot.index + 2 }
    case 'right':
      return { gridColumn: columns + 2, gridRow: slot.index + 2 }
  }
}

/** Memoized so a drag over 50 desks re-renders only the spots whose props changed (NFR). */
export const SlotView = memo(function SlotView(props: SlotViewProps & { readonly columns: number; readonly rows: number }) {
  const { slot, item } = props
  const { setNodeRef, isOver } = useDroppable({ id: slotKey(slot), disabled: !props.interactive })
  const isCell = slot.kind === 'cell'
  const classes = [
    isCell ? 'cell' : 'wall-seg',
    !isCell && `wall-seg-${slot.kind === 'wall' ? slot.wall : ''}`,
    props.band && `band-${props.band}`,
    isCell && !item && 'cell-empty',
    item?.kind === 'desk' && 'cell-desk',
    item?.kind === 'teacherDesk' && 'cell-teacher',
    item?.kind === 'door' && 'wall-door',
    props.selected && 'is-selected',
    props.held && 'is-held',
    props.dim && 'is-dim',
    props.emphasised && 'is-emphasised',
    props.mark && `mark-${props.mark}`,
    props.toolActive && !item && 'tool-active',
    isOver && 'is-over',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      className={classes}
      style={gridPlacement(slot, props.columns, props.rows)}
      data-slot={slotKey(slot)}
      tabIndex={props.focusable ? 0 : -1}
      aria-label={props.ariaLabel}
      aria-selected={props.selected}
    >
      {item && props.interactive ? (
        <DraggableFace item={item} text={props.text} doorNumber={props.doorNumber} />
      ) : (
        <Face item={item} text={props.text} mark={props.mark} doorNumber={props.doorNumber} />
      )}
    </div>
  )
})

function DraggableFace(props: { item: Item; text: string; doorNumber: number }) {
  const { setNodeRef, listeners } = useDraggable({ id: `${props.item.kind}:${props.item.id}` })
  return (
    <div ref={setNodeRef} className="item-drag" {...listeners}>
      <Face item={props.item} text={props.text} mark={null} doorNumber={props.doorNumber} />
    </div>
  )
}

function Face({ item, text, mark, doorNumber }: { item: Item | null; text: string; mark: Mark; doorNumber: number }) {
  if (!item) return null
  return (
    <span className="item-face" aria-hidden="true">
      {item.kind === 'door' && <span className="door-icon">{'⌒'}</span>}
      {item.kind === 'teacherDesk' && <span className="teacher-icon">{'★'}</span>}
      <span className="item-text">{item.kind === 'door' && doorNumber > 0 ? `${text} ${doorNumber}` : text}</span>
      {mark && <span className={`mark-badge mark-badge-${mark}`}>{mark === 'notMet' ? '⚠' : '–'}</span>}
    </span>
  )
}
