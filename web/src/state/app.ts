import { runBlockers } from '../model/blockers'
import type { SolveResponse } from '../model/contract'
import { emptyClassroom } from '../model/classroom'
import { editorReducer, initialEditor, type EditorAction, type EditorState } from '../model/history'
import { currentFingerprint, toRequest } from '../model/request'
import type { RunResult } from '../model/results'
import type { SolveFailure } from '../solver/client'
import { initialRun, isRunning, nextRunId, runReducer, type RunAttempt, type RunState } from './run'

export type Mode = 'plan' | 'results'

/** What the last finished run did, for the live region (S4: "Same arrangements as before"). */
export type RunNotice = 'ready' | 'same' | null

export interface AppState {
  readonly editor: EditorState
  readonly run: RunState
  readonly mode: Mode
  readonly notice: RunNotice
}

export type AppAction =
  | EditorAction
  | { readonly type: 'setMode'; readonly mode: Mode }
  | { readonly type: 'startRun'; readonly runId: number; readonly attempt: RunAttempt }
  | { readonly type: 'cancelRun' }
  | { readonly type: 'runSucceeded'; readonly runId: number; readonly response: SolveResponse }
  | { readonly type: 'runFailed'; readonly runId: number; readonly failure: SolveFailure }
  | { readonly type: 'dismissRunProblem' }

export const initialApp = (): AppState => ({
  editor: initialEditor(emptyClassroom()),
  run: initialRun,
  mode: 'plan',
  notice: null,
})

/** The attempt Run would send now, or null when something blocks it (FR-16). */
export function attemptFor(state: AppState): RunAttempt | null {
  const classroom = state.editor.present
  if (runBlockers(classroom).length > 0) return null
  return { request: toRequest(classroom), snapshot: classroom, fingerprint: currentFingerprint(classroom) }
}

export const nextRunIdOf = (state: AppState): number => nextRunId(state.run)

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'command':
    case 'undo':
    case 'redo':
    case 'storeResults':
    case 'clearFeedback':
      // Inputs and Undo/Redo are locked only while running (AD-8).
      if (isRunning(state.run) && action.type !== 'clearFeedback') return state
      return withEditor(state, editorReducer(state.editor, action))
    case 'setMode':
      return action.mode === 'results' && !state.editor.results ? state : { ...state, mode: action.mode }
    case 'startRun':
      return { ...state, run: runReducer(state.run, { type: 'start', runId: action.runId, attempt: action.attempt }), notice: null }
    case 'cancelRun':
      return { ...state, run: runReducer(state.run, { type: 'cancel' }) }
    case 'runSucceeded':
      return succeed(state, action.runId, action.response)
    case 'runFailed':
      return { ...state, run: runReducer(state.run, { type: 'fail', runId: action.runId, failure: action.failure }) }
    case 'dismissRunProblem':
      return { ...state, run: runReducer(state.run, { type: 'acknowledge' }) }
  }
}

/** An edit acknowledges a cancelled or failed run; Results is only shown while results exist. */
function withEditor(state: AppState, editor: EditorState): AppState {
  return {
    ...state,
    editor,
    run: runReducer(state.run, { type: 'acknowledge' }),
    mode: editor.results ? state.mode : 'plan',
  }
}

function succeed(state: AppState, runId: number, response: SolveResponse): AppState {
  const { run } = state
  if (run.phase !== 'running' || run.lastRunId !== runId) return state
  const result: RunResult = { ...run.attempt, arrangements: response.arrangements }
  const previous = state.editor.results
  const same = previous?.fingerprint === result.fingerprint && JSON.stringify(previous.arrangements) === JSON.stringify(result.arrangements)
  return {
    editor: editorReducer(state.editor, { type: 'storeResults', result }),
    run: runReducer(run, { type: 'finish', runId }),
    mode: 'results',
    notice: same ? 'same' : 'ready',
  }
}
