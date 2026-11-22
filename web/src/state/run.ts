import type { SolveRequest } from '../model/contract'
import type { RoomSnapshot } from '../model/results'
import type { SolveFailure } from '../solver/client'

/** Everything needed to build a RunResult, captured when Run is pressed (AD-11). */
export interface RunAttempt {
  readonly request: SolveRequest
  readonly snapshot: RoomSnapshot
  readonly fingerprint: string
}

/**
 * The run state machine (AD-8). `runId` grows with every start; a response is accepted only while
 * `running` with the same id, so a late answer after Cancel can never change anything.
 */
export type RunState =
  | { readonly phase: 'idle'; readonly lastRunId: number }
  | { readonly phase: 'running'; readonly lastRunId: number; readonly attempt: RunAttempt }
  | { readonly phase: 'cancelled'; readonly lastRunId: number }
  | { readonly phase: 'failed'; readonly lastRunId: number; readonly failure: SolveFailure; readonly attempt: RunAttempt }

export const initialRun: RunState = { phase: 'idle', lastRunId: 0 }

export type RunAction =
  | { readonly type: 'start'; readonly runId: number; readonly attempt: RunAttempt }
  | { readonly type: 'cancel' }
  | { readonly type: 'fail'; readonly runId: number; readonly failure: SolveFailure }
  | { readonly type: 'finish'; readonly runId: number }
  | { readonly type: 'acknowledge' }

export const nextRunId = (state: RunState): number => state.lastRunId + 1

export const isRunning = (state: RunState): boolean => state.phase === 'running'

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'start':
      if (state.phase === 'running' || action.runId <= state.lastRunId) return state
      return { phase: 'running', lastRunId: action.runId, attempt: action.attempt }
    case 'cancel':
      return state.phase === 'running' ? { phase: 'cancelled', lastRunId: state.lastRunId } : state
    case 'fail':
      return state.phase === 'running' && state.lastRunId === action.runId
        ? { phase: 'failed', lastRunId: state.lastRunId, failure: action.failure, attempt: state.attempt }
        : state
    case 'finish':
      return state.phase === 'running' && state.lastRunId === action.runId
        ? { phase: 'idle', lastRunId: state.lastRunId }
        : state
    case 'acknowledge':
      return state.phase === 'cancelled' || state.phase === 'failed' ? { phase: 'idle', lastRunId: state.lastRunId } : state
  }
}
