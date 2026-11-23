import type { Command } from '../model/classroom'
import { newId } from './ids'
import { slotFromKey, type Item, type Slot } from './slots'

export type Tool = 'desk' | 'door' | 'teacherDesk'

export const ITEM_NAMES: Readonly<Record<Item['kind'], string>> = { desk: 'Desk', teacherDesk: "Teacher's desk", door: 'Door' }

/** The command that places a new item from `tool` at `slot`, or the message explaining why it cannot go there. */
export function placementOf(tool: Tool, slot: Slot): Command | string {
  if (tool === 'door') {
    return slot.kind === 'wall' ? { type: 'placeDoor', id: newId(), wall: slot.wall, index: slot.index } : 'A door goes on a free spot on a wall.'
  }
  if (slot.kind !== 'cell') return `${ITEM_NAMES[tool]} goes on a cell inside the room.`
  return tool === 'desk' ? { type: 'placeDesk', id: newId(), cell: slot.cell } : { type: 'placeTeacherDesk', id: newId(), cell: slot.cell }
}

/** The command that moves a placed item to `slot`, or the message explaining why it cannot go there. */
export function movementOf(item: Item, slot: Slot): Command | string {
  if (item.kind === 'door') {
    return slot.kind === 'wall' ? { type: 'moveDoor', id: item.id, wall: slot.wall, index: slot.index } : 'A door goes on a free spot on a wall.'
  }
  if (slot.kind !== 'cell') return `That spot is outside the room. ${ITEM_NAMES[item.kind]} returned.`
  return item.kind === 'desk' ? { type: 'moveDesk', id: item.id, to: slot.cell } : { type: 'moveTeacherDesk', to: slot.cell }
}

/** The command that removes a placed item. */
export function removalOf(item: Item): Command {
  switch (item.kind) {
    case 'desk':
      return { type: 'removeDesk', id: item.id }
    case 'teacherDesk':
      return { type: 'removeTeacherDesk' }
    case 'door':
      return { type: 'removeDoor', id: item.id }
  }
}

/**
 * What dropping a dragged thing on a target does. `activeId` is "tool:<tool>" for a palette tool or
 * "<kind>:<id>" for a placed item; `overId` is "palette" or a slot key. Null when the drop is ignored.
 */
export function dropOutcome(activeId: string, overId: string): Command | string | null {
  const [kind, id = ''] = activeId.split(/:(.*)/s)
  const item = asItem(kind, id)
  if (overId === 'palette') return item ? removalOf(item) : null
  const slot = slotFromKey(overId)
  if (!slot) return null
  if (kind === 'tool') return placementOf(id as Tool, slot)
  return item ? movementOf(item, slot) : null
}

function asItem(kind: string | undefined, id: string): Item | null {
  return kind === 'desk' || kind === 'teacherDesk' || kind === 'door' ? { kind, id } : null
}
