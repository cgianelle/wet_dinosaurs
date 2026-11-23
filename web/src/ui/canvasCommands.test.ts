import { describe, expect, it } from 'vitest'
import { dropOutcome, movementOf, placementOf, removalOf } from './canvasCommands'

describe('dropOutcome', () => {
  it('places a desk dragged from the palette tool onto a cell', () => {
    expect(dropOutcome('tool:desk', 'c:2,1')).toMatchObject({ type: 'placeDesk', cell: { column: 2, row: 1 } })
  })

  it('places the teacher desk from its tool onto a cell', () => {
    expect(dropOutcome('tool:teacherDesk', 'c:0,0')).toMatchObject({ type: 'placeTeacherDesk', cell: { column: 0, row: 0 } })
  })

  it('places a door dragged from the palette onto a wall spot', () => {
    expect(dropOutcome('tool:door', 'w:left:3')).toMatchObject({ type: 'placeDoor', wall: 'left', index: 3 })
  })

  it('refuses a door dropped on a cell, with the reason', () => {
    expect(dropOutcome('tool:door', 'c:1,1')).toBe('A door goes on a free spot on a wall.')
  })

  it('refuses a desk dropped on a wall, with the reason', () => {
    expect(dropOutcome('tool:desk', 'w:top:0')).toBe('Desk goes on a cell inside the room.')
  })

  it('moves a placed desk to another cell', () => {
    expect(dropOutcome('desk:d1', 'c:3,2')).toEqual({ type: 'moveDesk', id: 'd1', to: { column: 3, row: 2 } })
  })

  it('moves the teacher desk to another cell', () => {
    expect(dropOutcome('teacherDesk:t', 'c:3,2')).toEqual({ type: 'moveTeacherDesk', to: { column: 3, row: 2 } })
  })

  it('moves a door along the walls', () => {
    expect(dropOutcome('door:x1', 'w:bottom:2')).toEqual({ type: 'moveDoor', id: 'x1', wall: 'bottom', index: 2 })
  })

  it('returns a desk dragged onto a wall, with the reason', () => {
    expect(dropOutcome('desk:d1', 'w:top:0')).toBe('That spot is outside the room. Desk returned.')
  })

  it('returns a door dragged onto a cell, with the reason', () => {
    expect(dropOutcome('door:x1', 'c:0,0')).toBe('A door goes on a free spot on a wall.')
  })

  it('removes a placed item dropped on the palette', () => {
    expect(dropOutcome('desk:d1', 'palette')).toEqual(removeDesk('d1'))
    expect(dropOutcome('teacherDesk:t', 'palette')).toEqual({ type: 'removeTeacherDesk' })
    expect(dropOutcome('door:x1', 'palette')).toEqual({ type: 'removeDoor', id: 'x1' })
  })

  it('keeps ids that contain a colon whole', () => {
    expect(dropOutcome('desk:a:b', 'palette')).toEqual(removeDesk('a:b'))
  })

  it('ignores a palette tool dropped back on the palette', () => {
    expect(dropOutcome('tool:desk', 'palette')).toBeNull()
  })

  it('ignores a drop on something that is not a spot', () => {
    expect(dropOutcome('desk:d1', 'nowhere')).toBeNull()
    expect(dropOutcome('desk:d1', '')).toBeNull()
  })

  it('ignores an unknown dragged thing', () => {
    expect(dropOutcome('mystery:1', 'c:0,0')).toBeNull()
  })
})

describe('command mapping', () => {
  it('agrees with dropOutcome for placement, movement and removal', () => {
    expect(placementOf('desk', { kind: 'cell', cell: { column: 0, row: 0 } })).toMatchObject({ type: 'placeDesk' })
    expect(movementOf({ kind: 'desk', id: 'd' }, { kind: 'cell', cell: { column: 1, row: 1 } })).toMatchObject({ type: 'moveDesk' })
    expect(removalOf({ kind: 'desk', id: 'd' })).toEqual(removeDesk('d'))
  })
})

const removeDesk = (id: string) => ({ type: 'removeDesk', id })
