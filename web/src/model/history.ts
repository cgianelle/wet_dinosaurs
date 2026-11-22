import { applyCommand, commandLabel, type Command, type CommandInfo, type Rejection } from './classroom'
import { MAX_UNDO_STEPS } from './limits'
import type { RunResult } from './results'
import type { Classroom } from './types'

/**
 * One history entry. In `past` it holds the classroom before the step; in `future` the classroom
 * after it. Only Start over carries `resultsBefore` (the results it cleared), so undoing it brings
 * them back and redoing it clears them again (AD-9).
 */
export interface Step {
  readonly classroom: Classroom
  readonly label: string
  readonly resultsBefore?: RunResult | null
}

export type Feedback =
  | { readonly kind: 'accepted'; readonly label: string; readonly info: CommandInfo }
  | { readonly kind: 'rejected'; readonly command: Command; readonly rejection: Rejection }
  | { readonly kind: 'undone' | 'redone'; readonly label: string }

export interface EditorState {
  readonly past: readonly Step[]
  readonly present: Classroom
  readonly future: readonly Step[]
  /** The stored results of the last successful Run; not part of ordinary history. */
  readonly results: RunResult | null
  /** What the last action did, for live regions and captions. Never read by the model. */
  readonly feedback: Feedback | null
}

export type EditorAction =
  | { readonly type: 'command'; readonly command: Command }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' }
  | { readonly type: 'storeResults'; readonly result: RunResult }
  | { readonly type: 'clearFeedback' }

export const initialEditor = (present: Classroom): EditorState => ({
  past: [],
  present,
  future: [],
  results: null,
  feedback: null,
})

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'command':
      return runCommand(state, action.command)
    case 'undo':
      return undo(state)
    case 'redo':
      return redo(state)
    case 'storeResults':
      return { ...state, results: action.result }
    case 'clearFeedback':
      return { ...state, feedback: null }
  }
}

function runCommand(state: EditorState, command: Command): EditorState {
  const result = applyCommand(state.present, command)
  if (!result.ok) return { ...state, feedback: { kind: 'rejected', command, rejection: result.rejection } }
  const label = commandLabel(command)
  const clearsResults = command.type === 'startOver'
  const step: Step = clearsResults
    ? { classroom: state.present, label, resultsBefore: state.results }
    : { classroom: state.present, label }
  return {
    past: [...state.past, step].slice(-MAX_UNDO_STEPS),
    present: result.classroom,
    future: [],
    results: clearsResults ? null : state.results,
    feedback: { kind: 'accepted', label, info: result.info },
  }
}

function undo(state: EditorState): EditorState {
  const step = state.past.at(-1)
  if (!step) return state
  const redoStep: Step = { ...step, classroom: state.present }
  return {
    past: state.past.slice(0, -1),
    present: step.classroom,
    future: [redoStep, ...state.future],
    results: step.resultsBefore !== undefined ? step.resultsBefore : state.results,
    feedback: { kind: 'undone', label: step.label },
  }
}

function redo(state: EditorState): EditorState {
  const step = state.future[0]
  if (!step) return state
  const undoStep: Step = { ...step, classroom: state.present }
  return {
    past: [...state.past, undoStep].slice(-MAX_UNDO_STEPS),
    present: step.classroom,
    future: state.future.slice(1),
    results: step.resultsBefore !== undefined ? null : state.results,
    feedback: { kind: 'redone', label: step.label },
  }
}

export const canUndo = (s: EditorState): boolean => s.past.length > 0
export const canRedo = (s: EditorState): boolean => s.future.length > 0
export const nextUndoLabel = (s: EditorState): string | null => s.past.at(-1)?.label ?? null
export const nextRedoLabel = (s: EditorState): string | null => s.future[0]?.label ?? null
