import { act, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Command } from '../model/classroom'
import type { SolveRequest, SolveResponse } from '../model/contract'
import { appReducer, initialApp, type AppState } from '../state/app'
import { App } from './App'

function stateWith(...commands: Command[]): AppState {
  return commands.reduce((state, command) => appReducer(state, { type: 'command', command }), initialApp())
}

const readyRoom = (): AppState =>
  stateWith(
    { type: 'placeTeacherDesk', id: 'teacher', cell: { column: 7, row: 0 } },
    { type: 'placeDoor', id: 'door', wall: 'bottom', index: 4 },
    { type: 'placeDesk', id: 'd1', cell: { column: 1, row: 1 } },
    { type: 'placeDesk', id: 'd2', cell: { column: 2, row: 1 } },
    { type: 'placeDesk', id: 'd3', cell: { column: 3, row: 1 } },
    { type: 'addStudent', id: 's1', name: 'Maya' },
    { type: 'addStudent', id: 's2', name: 'Leo' },
    { type: 'addStudent', id: 's3', name: 'Sam' },
    { type: 'addRule', rule: { id: 'r1', type: 'front', studentId: 's1' } },
    { type: 'addRule', rule: { id: 'r2', type: 'notNear', studentIds: ['s2', 's3'] } },
  )

const response: SolveResponse = {
  arrangements: [
    {
      rank: 1,
      scores: { front: 10, nearBy: -20, isle: 0, total: -10, weighted100: -1240 },
      rulesMet: 1,
      rulesTotal: 2,
      assignments: [
        { studentId: 's1', deskId: 'd1' },
        { studentId: 's2', deskId: 'd2' },
        { studentId: 's3', deskId: 'd3' },
      ],
      outcomes: [
        { ruleId: 'r1', result: 'met', detail: { row: 1, rows: 1 } },
        { ruleId: 'r2', result: 'notMet', detail: { distance: 1 } },
      ],
    },
    {
      rank: 2,
      scores: { front: 10, nearBy: -20, isle: 0, total: -10, weighted100: -1300 },
      rulesMet: 1,
      rulesTotal: 2,
      assignments: [
        { studentId: 's1', deskId: 'd2' },
        { studentId: 's2', deskId: 'd1' },
        { studentId: 's3', deskId: 'd3' },
      ],
      outcomes: [
        { ruleId: 'r1', result: 'met', detail: { row: 1, rows: 1 } },
        { ruleId: 'r2', result: 'notMet', detail: { distance: 2 } },
      ],
    },
  ],
}

const respondWith = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('Plan mode', () => {
  it('shows what blocks Run and explains it when Run is pressed', () => {
    const fetchSpy = respondWith(response)
    vi.stubGlobal('fetch', fetchSpy)
    render(<App />)
    const run = screen.getByRole('button', { name: 'Run' })
    expect(run.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(run)
    const checklist = screen.getAllByRole('list', { name: 'Run checklist' })[0]!
    expect(within(checklist).getByText('Add at least 1 student.')).toBeTruthy()
    expect(within(checklist).queryByText(/Front/)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('adds a student, keeps a duplicate in the field with an inline message', () => {
    render(<App />)
    const input = screen.getByLabelText('Student name') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Maya ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText('Maya')).toBeTruthy()
    expect(screen.getByText('1 of 50')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'MAYA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByText(/There is already a student named 'MAYA'/)).toBeTruthy()
    expect(input.value).toBe('MAYA')
  })

  it('names the fix for a count mismatch', () => {
    render(<App initial={stateWith({ type: 'placeDesk', id: 'd', cell: { column: 0, row: 0 } })} />)
    expect(screen.getAllByText(/1 desk, 0 students\. Add 1 student or remove 1 desk\./).length).toBeGreaterThan(0)
  })

  it('moves a desk from the keyboard: pick up, arrow, drop', () => {
    render(<App initial={stateWith({ type: 'placeDesk', id: 'd', cell: { column: 0, row: 0 } })} />)
    const grid = screen.getByRole('grid', { name: 'Room' })
    const first = within(grid).getByRole('gridcell', { name: 'Screen row 1, column 1, desk' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    const target = within(grid).getByRole('gridcell', { name: 'Screen row 1, column 2, empty' })
    fireEvent.keyDown(target, { key: 'Enter' })
    expect(within(grid).getByRole('gridcell', { name: 'Screen row 1, column 2, desk' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Screen row 1, column 1, empty' })).toBeTruthy()
  })

  it('always has a front wall: the top band reads Front of room and the others Back and Side', () => {
    render(<App />)
    const grid = screen.getByRole('grid', { name: 'Room' })
    expect(within(grid).getByRole('gridcell', { name: 'Top wall, above column 1, Front of room' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Bottom wall, below column 1, Back of room' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Left wall, left of row 1, Side wall' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Right wall, right of row 1, Side wall' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Top' }) as HTMLInputElement).checked).toBe(true)
  })

  it('changes the front wall from the radio group and relabels every band', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('radio', { name: 'Left' }))
    const grid = screen.getByRole('grid', { name: 'Room' })
    expect(within(grid).getByRole('gridcell', { name: 'Left wall, left of row 1, Front of room' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Right wall, right of row 1, Back of room' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Top wall, above column 1, Side wall' })).toBeTruthy()
    expect(screen.getAllByText('Front wall is now the left wall. Back is the right wall. Rules now count rows from the left.').length).toBeGreaterThan(0)
  })

  it('makes a clicked wall the front wall from the selection strip', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('gridcell', { name: 'Bottom wall, below column 3, Back of room' }))
    expect(screen.getByText(/Bottom wall \(Back of room\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Make this the front wall' }))
    expect((screen.getByRole('radio', { name: 'Bottom' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('button', { name: 'Make this the front wall' })).toBeNull()
  })

  it('places a door on a wall with the click alternative and refuses a taken spot', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Door/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: 'Top wall, above column 2, Front of room' }))
    expect(screen.getByRole('gridcell', { name: 'Top wall, above column 2, Front of room, Door' })).toBeTruthy()
    fireEvent.click(screen.getByRole('gridcell', { name: 'Top wall, above column 2, Front of room, Door' }))
    expect(screen.getByText('Door on the top wall, screen column 2')).toBeTruthy()
  })

  describe('paint-drag with the Desk tool', () => {
    const nearlyFullRoom = (): AppState => {
      const cells = Array.from({ length: 49 }, (_, i) => ({ column: i % 10, row: Math.floor(i / 10) }))
      return stateWith(
        { type: 'resizeGrid', columns: 10, rows: 6 },
        ...cells.map((cell, i): Command => ({ type: 'placeDesk', id: `d${i}`, cell })),
      )
    }
    const cellAt = (grid: HTMLElement, row: number, column: number, what: string) =>
      within(grid).getByRole('gridcell', { name: `Screen row ${row}, column ${column}, ${what}` })

    it('says some cells were not filled when the 50-desk cap cuts a stroke short', () => {
      render(<App initial={nearlyFullRoom()} />)
      const grid = screen.getByRole('grid', { name: 'Room' })
      fireEvent.click(screen.getByRole('button', { name: /^Desk/ }))
      const press = createEvent.pointerDown(cellAt(grid, 6, 1, 'empty'), { button: 0 })
      fireEvent(cellAt(grid, 6, 1, 'empty'), press)
      fireEvent.pointerOver(cellAt(grid, 6, 2, 'empty'))
      fireEvent.pointerOver(cellAt(grid, 6, 3, 'empty'))
      expect(screen.queryByText(/Some cells were not filled/)).toBeNull()
      fireEvent.pointerUp(window)
      expect(screen.getAllByText('Room is full (50 desks). Some cells were not filled.').length).toBeGreaterThan(0)
      expect(cellAt(grid, 6, 1, 'desk')).toBeTruthy()
      expect(cellAt(grid, 6, 2, 'empty')).toBeTruthy()
    })

    it('says nothing extra when the stroke fits under the cap', () => {
      render(<App initial={nearlyFullRoom()} />)
      const grid = screen.getByRole('grid', { name: 'Room' })
      fireEvent.click(screen.getByRole('button', { name: /^Desk/ }))
      fireEvent(cellAt(grid, 6, 1, 'empty'), createEvent.pointerDown(cellAt(grid, 6, 1, 'empty'), { button: 0 }))
      fireEvent.pointerUp(window)
      expect(screen.queryByText(/Some cells were not filled/)).toBeNull()
    })
  })

  it('refuses a door on a grid cell and a desk on a wall, in plain words', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Door/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: 'Screen row 1, column 1, empty' }))
    expect(screen.getAllByText('A door goes on a free spot on a wall.').length).toBeGreaterThan(0)
    expect(screen.queryByRole('gridcell', { name: 'Screen row 1, column 1, desk' })).toBeNull()
  })

  it("places the teacher's desk, keeps it out of the desk count and limits it to one", () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Teacher's desk/ }))
    fireEvent.click(screen.getByRole('gridcell', { name: 'Screen row 1, column 1, empty' }))
    expect(screen.getByRole('gridcell', { name: "Screen row 1, column 1, Teacher's desk" })).toBeTruthy()
    expect(screen.getByText('0 of 50 desks')).toBeTruthy()
    const tool = screen.getByRole('button', { name: /^Teacher's desk/ })
    expect(tool.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Already placed. Move or remove it.')).toBeTruthy()
  })

  it('picks up a door from the keyboard and drops it on another wall spot', () => {
    render(<App initial={stateWith({ type: 'placeDoor', id: 'door', wall: 'top', index: 0 })} />)
    const grid = screen.getByRole('grid', { name: 'Room' })
    const door = within(grid).getByRole('gridcell', { name: 'Top wall, above column 1, Front of room, Door' })
    fireEvent.focus(door)
    fireEvent.keyDown(door, { key: 'Enter' })
    fireEvent.keyDown(door, { key: 'ArrowRight' })
    const target = within(grid).getByRole('gridcell', { name: 'Top wall, above column 2, Front of room' })
    fireEvent.keyDown(target, { key: 'Enter' })
    expect(within(grid).getByRole('gridcell', { name: 'Top wall, above column 2, Front of room, Door' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Top wall, above column 1, Front of room' })).toBeTruthy()
  })

  it('moves focus from an edge cell onto the wall segment, corners skipped', () => {
    render(<App />)
    const grid = screen.getByRole('grid', { name: 'Room' })
    const first = within(grid).getByRole('gridcell', { name: 'Screen row 1, column 1, empty' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    const wall = within(grid).getByRole('gridcell', { name: 'Top wall, above column 1, Front of room' })
    expect(wall.getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(wall, { key: 'ArrowLeft' })
    expect(wall.getAttribute('tabindex')).toBe('0')
  })

  it('confirms a shrink that would cut off a door and names it', () => {
    render(<App initial={stateWith({ type: 'placeDoor', id: 'door', wall: 'top', index: 7 })} />)
    fireEvent.change(screen.getByLabelText('Columns'), { target: { value: '5' } })
    fireEvent.blur(screen.getByLabelText('Columns'))
    expect(screen.getByText(/deletes 1 door/)).toBeTruthy()
  })

  it('undoes an edit from the header, naming it', () => {
    render(<App initial={readyRoom()} />)
    const undo = screen.getByRole('button', { name: 'Undo: add rule' })
    fireEvent.click(undo)
    expect(screen.getByRole('button', { name: 'Undo: add rule' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Redo: add rule' })).toBeTruthy()
  })
})

describe('Run', () => {
  it('sends ids only, then shows Results with "N of M rules met"', async () => {
    const fetchSpy = respondWith(response)
    vi.stubGlobal('fetch', fetchSpy)
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Seating plans' })).toBeTruthy())
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    const sent = JSON.parse(String(init.body)) as SolveRequest
    expect(sent.frontEdge).toBe('top')
    expect(String(init.body)).not.toContain('Maya')
    expect(screen.getByRole('tab', { name: /Option 1.*1 of 2 rules met/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Option 1.*Score \(higher is better\): −12\.40/ })).toBeTruthy()
  })

  it('shows the FR-37 banner and the reason line of a selected rule', async () => {
    vi.stubGlobal('fetch', respondWith(response))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByRole('heading', { name: 'Seating plans' })
    expect(screen.getByText('No option satisfies every rule. Option 1 breaks the fewest.')).toBeTruthy()
    expect(screen.getByText('Only 2 different arrangements exist.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Not met.*Leo and Sam do not sit near each other/ }))
    expect(screen.getByText('Leo sits 1 desk from Sam')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Option 2/ }))
    expect(screen.getByText('Leo sits 2 desks from Sam')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Met.*Maya sits near the front/ }))
    expect(screen.getByText('Maya sits in row 1 of 1, counting from the front wall')).toBeTruthy()
  })

  it('keeps all input and offers a retry when the service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText("We can't reach the seating service. Check your connection and try again.")).toBeTruthy()
    expect(screen.getAllByText('Maya').length).toBeGreaterThan(0)
    vi.stubGlobal('fetch', respondWith(response))
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    await screen.findByRole('heading', { name: 'Seating plans' })
  })

  it('shows the busy variant with Try again and keeps the input', async () => {
    vi.stubGlobal('fetch', respondWith({ error: { code: 'busy' } }, 503))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('The seating service is busy right now. Try again in a moment.')).toBeTruthy()
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy()
    expect(screen.getAllByText('Maya').length).toBeGreaterThan(0)
  })

  it('shows one Unexpected variant for a rejected request, with the code only under Show details', async () => {
    vi.stubGlobal('fetch', respondWith({ error: { code: 'count_mismatch', field: 'students' } }, 400))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Something went wrong on our side. Try again.')).toBeTruthy()
    expect(within(alert).queryByText('Service rejected the input')).toBeNull()
    expect(within(alert).getByText('Error code: count_mismatch. Field: students')).toBeTruthy()
  })

  it('shows the shared limit message first for a rejected limit', async () => {
    vi.stubGlobal('fetch', respondWith({ error: { code: 'limit_exceeded', field: 'desks', limit: 50 } }, 400))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Room is full (50 desks). Try again.')).toBeTruthy()
  })

  it('cancels a run, unlocks the editor and drops the late answer', async () => {
    let finish: (r: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (finish = resolve))))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    expect(await screen.findByText(/Finding the best seating plans for 3 students/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Finding the best seating plans/)).toBeNull()
    await act(async () => finish(new Response(JSON.stringify(response), { status: 200 })))
    expect(screen.queryByRole('heading', { name: 'Seating plans' })).toBeNull()
    expect((screen.getByLabelText('Student name') as HTMLInputElement).disabled).toBe(false)
  })

  it('marks results Out of date after an edit but not after a rename', async () => {
    vi.stubGlobal('fetch', respondWith(response))
    render(<App initial={readyRoom()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))
    await screen.findByRole('heading', { name: 'Seating plans' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Maya' }))
    const rename = screen.getByLabelText('New name for Maya')
    fireEvent.change(rename, { target: { value: 'Maya R.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Out of date')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Sam' }))
    fireEvent.click(screen.getByRole('button', { name: /Remove student and 1 rule/ }))
    expect(screen.getByText('Out of date')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Results/ }))
    expect(screen.getByText(/Names are as of the last run/)).toBeTruthy()
    expect(screen.getAllByText(/Maya/).length).toBeGreaterThan(0)
  })
})
