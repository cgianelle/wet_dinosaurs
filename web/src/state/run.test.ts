import { describe, expect, it } from 'vitest'
import { emptyClassroom } from '../model/classroom'
import { initialRun, runReducer, type RunAttempt, type RunState } from './run'

const attempt: RunAttempt = {
  request: { grid: { columns: 1, rows: 1 }, frontEdge: 'top', desks: [], students: [], rules: [] },
  snapshot: emptyClassroom(),
  fingerprint: 'f',
}

const started = (): RunState => runReducer(initialRun, { type: 'start', runId: 1, attempt })

describe('run state machine', () => {
  it('runs one at a time', () => {
    const running = started()
    expect(runReducer(running, { type: 'start', runId: 2, attempt })).toBe(running)
  })

  it('accepts a result only for the current run id', () => {
    const running = started()
    expect(runReducer(running, { type: 'finish', runId: 7 })).toBe(running)
    expect(runReducer(running, { type: 'finish', runId: 1 }).phase).toBe('idle')
  })

  it('discards a late result after cancel', () => {
    const cancelled = runReducer(started(), { type: 'cancel' })
    expect(cancelled.phase).toBe('cancelled')
    expect(runReducer(cancelled, { type: 'finish', runId: 1 })).toBe(cancelled)
    expect(runReducer(cancelled, { type: 'fail', runId: 1, failure: { kind: 'timeout' } })).toBe(cancelled)
  })

  it('does not reuse a run id, so a stale start cannot supersede', () => {
    const cancelled = runReducer(started(), { type: 'cancel' })
    expect(runReducer(cancelled, { type: 'start', runId: 1, attempt })).toBe(cancelled)
    expect(runReducer(cancelled, { type: 'start', runId: 2, attempt }).phase).toBe('running')
  })

  it('keeps the attempt on failure so Try again can resend it', () => {
    const failed = runReducer(started(), { type: 'fail', runId: 1, failure: { kind: 'busy' } })
    expect(failed.phase === 'failed' && failed.attempt).toBe(attempt)
  })

  it('clears cancelled and failed on acknowledge', () => {
    expect(runReducer(runReducer(started(), { type: 'cancel' }), { type: 'acknowledge' }).phase).toBe('idle')
  })
})
