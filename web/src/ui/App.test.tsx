import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    { type: 'placeMarker', id: 'front', kind: 'front', cell: { column: 3, row: 0 } },
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
    expect(within(checklist).getByText('Place the Front marker on a cell at the edge of the room.')).toBeTruthy()
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
    const first = within(grid).getByRole('gridcell', { name: 'Row 1, column 1, desk' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Enter' })
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    const target = within(grid).getByRole('gridcell', { name: 'Row 1, column 2, empty' })
    fireEvent.keyDown(target, { key: 'Enter' })
    expect(within(grid).getByRole('gridcell', { name: 'Row 1, column 2, desk' })).toBeTruthy()
    expect(within(grid).getByRole('gridcell', { name: 'Row 1, column 1, empty' })).toBeTruthy()
  })

  it('reports a rejected Front placement in plain language', () => {
    render(<App initial={stateWith({ type: 'placeMarker', id: 'f', kind: 'front', cell: { column: 0, row: 0 } })} />)
    expect(screen.getAllByText('The Front marker goes on the edge of the room, not in a corner or the middle.').length).toBeGreaterThan(0)
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
