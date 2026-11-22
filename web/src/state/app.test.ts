import { describe, expect, it, vi } from 'vitest'
import type { SolveResponse } from '../model/contract'
import type { Command } from '../model/classroom'
import { appReducer, attemptFor, initialApp, nextRunIdOf, type AppAction, type AppState } from './app'
import { createRunner } from './runner'
import type { SolveOutcome } from '../solver/client'

const roomCommands: Command[] = [
  { type: 'placeMarker', id: 'f', kind: 'front', cell: { column: 3, row: 0 } },
  { type: 'placeDesk', id: 'd1', cell: { column: 1, row: 1 } },
  { type: 'addStudent', id: 's1', name: 'Maya' },
]

const reduceAll = (state: AppState, ...actions: AppAction[]): AppState => actions.reduce(appReducer, state)
const ready = (): AppState => reduceAll(initialApp(), ...roomCommands.map((command): AppAction => ({ type: 'command', command })))
const response: SolveResponse = {
  arrangements: [
    {
      rank: 1,
      scores: { front: 0, nearBy: 0, isle: 0, total: 0, weighted100: 0 },
      rulesMet: 0,
      rulesTotal: 0,
      assignments: [{ studentId: 's1', deskId: 'd1' }],
      outcomes: [],
    },
  ],
}

function running(): { state: AppState; runId: number } {
  const state = ready()
  const attempt = attemptFor(state)!
  const runId = nextRunIdOf(state)
  return { state: appReducer(state, { type: 'startRun', runId, attempt }), runId }
}

describe('app reducer', () => {
  it('offers an attempt only when nothing blocks Run', () => {
    expect(attemptFor(initialApp())).toBeNull()
    expect(attemptFor(ready())).not.toBeNull()
  })

  it('locks edits, undo and redo while running', () => {
    const { state } = running()
    const edited = appReducer(state, { type: 'command', command: { type: 'addStudent', id: 'x', name: 'Leo' } })
    expect(edited.editor.present.students).toHaveLength(1)
    expect(appReducer(state, { type: 'undo' }).editor).toBe(state.editor)
  })

  it('stores results and opens Results on success', () => {
    const { state, runId } = running()
    const done = appReducer(state, { type: 'runSucceeded', runId, response })
    expect(done.mode).toBe('results')
    expect(done.run.phase).toBe('idle')
    expect(done.editor.results?.snapshot.students[0]?.name).toBe('Maya')
    expect(done.notice).toBe('ready')
  })

  it('says "same" when a second run returns identical arrangements', () => {
    const first = running()
    const done = appReducer(first.state, { type: 'runSucceeded', runId: first.runId, response })
    const attempt = attemptFor(done)!
    const again = appReducer(done, { type: 'startRun', runId: nextRunIdOf(done), attempt })
    const second = appReducer(again, { type: 'runSucceeded', runId: nextRunIdOf(done), response })
    expect(second.notice).toBe('same')
  })

  it('keeps input and earlier results when a run fails or is cancelled', () => {
    const first = running()
    const done = appReducer(first.state, { type: 'runSucceeded', runId: first.runId, response })
    const again = appReducer(done, { type: 'startRun', runId: nextRunIdOf(done), attempt: attemptFor(done)! })
    const failed = appReducer(again, { type: 'runFailed', runId: nextRunIdOf(done), failure: { kind: 'timeout' } })
    expect(failed.run.phase).toBe('failed')
    expect(failed.editor.results).toBe(done.editor.results)
    expect(failed.editor.present).toBe(done.editor.present)
  })

  it('ignores a late success after cancel', () => {
    const { state, runId } = running()
    const cancelled = appReducer(state, { type: 'cancelRun' })
    const late = appReducer(cancelled, { type: 'runSucceeded', runId, response })
    expect(late).toBe(cancelled)
    expect(late.editor.results).toBeNull()
  })

  it('leaves Results mode when start over clears the results', () => {
    const { state, runId } = running()
    const done = appReducer(state, { type: 'runSucceeded', runId, response })
    const cleared = appReducer(done, { type: 'command', command: { type: 'startOver' } })
    expect(cleared.mode).toBe('plan')
    expect(cleared.editor.results).toBeNull()
  })

  it('refuses Results mode while there are no results', () => {
    expect(appReducer(initialApp(), { type: 'setMode', mode: 'results' }).mode).toBe('plan')
  })
})

describe('runner', () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('dispatches the outcome with its run id', async () => {
    const dispatch = vi.fn()
    const send = vi.fn((): Promise<SolveOutcome> => Promise.resolve({ kind: 'ok', response }))
    createRunner(dispatch, send).start(1, attemptFor(ready())!)
    await flush()
    expect(dispatch.mock.calls.map(([a]) => (a as AppAction).type)).toEqual(['startRun', 'runSucceeded'])
  })

  it('aborts on cancel and drops the late answer', async () => {
    const dispatch = vi.fn()
    let resolveLate: (outcome: SolveOutcome) => void = () => {}
    let signal: AbortSignal | undefined
    const send = (_request: unknown, options: { signal?: AbortSignal }): Promise<SolveOutcome> => {
      signal = options.signal
      return new Promise((resolve) => (resolveLate = resolve))
    }
    const runner = createRunner(dispatch, send)
    runner.start(1, attemptFor(ready())!)
    runner.cancel()
    resolveLate({ kind: 'ok', response })
    await flush()
    expect(signal?.aborted).toBe(true)
    expect(dispatch.mock.calls.map(([a]) => (a as AppAction).type)).toEqual(['startRun', 'cancelRun'])
  })
})
