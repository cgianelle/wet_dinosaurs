import { useRef, type PointerEvent } from 'react'
import { limitMessage, MAX_DESKS } from '../model/limits'
import type { Classroom } from '../model/types'
import { itemAt, slotFromEvent, type Slot } from './slots'

export const STROKE_CUT_SHORT = ' Some cells were not filled.'

interface PaintStroke {
  readonly classroom: Classroom
  /** False unless the Desk tool is active on an unlocked, editable canvas. */
  readonly enabled: boolean
  readonly placeDesk: (slot: Slot) => void
  readonly notify: (message: string) => void
}

const isEmptyCell = (classroom: Classroom, slot: Slot | null): slot is Slot =>
  slot?.kind === 'cell' && itemAt(classroom, slot) === null

/** The Desk tool paints on press and drag; a stroke stopped by the desk cap says so on release. */
export function usePaintStroke({ classroom, enabled, placeDesk, notify }: PaintStroke) {
  const painting = useRef(false)
  const cutShort = useRef(false)

  const endStroke = () => {
    painting.current = false
    if (cutShort.current) notify(limitMessage('desks') + STROKE_CUT_SHORT)
    cutShort.current = false
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.button !== 0) return
    const slot = slotFromEvent(event.target)
    if (!isEmptyCell(classroom, slot)) return
    painting.current = true
    cutShort.current = false
    placeDesk(slot)
    window.addEventListener('pointerup', endStroke, { once: true })
  }

  const onPointerOver = (event: PointerEvent<HTMLElement>) => {
    if (!painting.current) return
    const slot = slotFromEvent(event.target)
    if (!isEmptyCell(classroom, slot)) return
    if (classroom.desks.length >= MAX_DESKS) cutShort.current = true
    else placeDesk(slot)
  }

  return { onPointerDown, onPointerOver }
}
