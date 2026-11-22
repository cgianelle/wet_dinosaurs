import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type { Command } from '../model/classroom'
import { appReducer, attemptFor, initialApp, nextRunIdOf, type AppAction, type AppState, type Mode } from '../state/app'
import { createRunner } from '../state/runner'
import { feedbackMessage } from './text'

export interface AppApi {
  readonly state: AppState
  /** True while a run is in progress: inputs are read-only (S4). */
  readonly locked: boolean
  /** The latest editor feedback as plain text, shown as a caption under the canvas. */
  readonly caption: string
  readonly dispatchCommand: (command: Command) => void
  readonly undo: () => void
  readonly redo: () => void
  readonly run: () => boolean
  readonly retry: () => void
  readonly cancel: () => void
  readonly dismissRunProblem: () => void
  readonly setMode: (mode: Mode) => void
  readonly announce: (message: string) => void
}

const AppContext = createContext<AppApi | null>(null)

export function useApp(): AppApi {
  const api = useContext(AppContext)
  if (!api) throw new Error('useApp must be used inside <AppProvider>')
  return api
}

export function AppProvider({ children, initial }: { children: ReactNode; initial?: AppState }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initial ?? initialApp())
  const stateRef = useRef(state)
  stateRef.current = state
  const [announcement, setAnnouncement] = useState('')
  const [caption, setCaption] = useState('')
  const previousRoom = useRef(state.editor.present)

  const announce = useCallback((message: string) => {
    // Alternate a trailing space so an identical message is announced again.
    setAnnouncement((previous) => (previous === message ? `${message}\u00A0` : message))
  }, [])

  useEffect(() => {
    const { feedback, present } = state.editor
    if (!feedback) return
    const text = feedbackMessage(feedback, present, previousRoom.current)
    setCaption(text)
    announce(text)
  }, [state.editor.feedback])

  useEffect(() => {
    previousRoom.current = state.editor.present
  }, [state.editor.present])

  useEffect(() => {
    if (state.notice === 'ready') announce('Results ready. ' + (state.editor.results?.arrangements.length ?? 0) + ' options.')
    if (state.notice === 'same') announce('Same arrangements as before. Change the room, students or rules to get different ones.')
  }, [state.notice, state.editor.results])

  const room = state.editor.present
  const hasContent = room.desks.length + room.markers.length + room.students.length > 0
  useEffect(() => {
    if (!hasContent) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasContent])

  const runner = useMemo(() => createRunner((action: AppAction) => dispatch(action)), [])

  const api = useMemo<AppApi>(
    () => ({
      state,
      locked: state.run.phase === 'running',
      caption,
      dispatchCommand: (command) => dispatch({ type: 'command', command }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      run: () => {
        const attempt = attemptFor(stateRef.current)
        if (!attempt || stateRef.current.run.phase === 'running') return false
        runner.start(nextRunIdOf(stateRef.current), attempt)
        return true
      },
      retry: () => {
        const { run } = stateRef.current
        if (run.phase === 'failed') runner.start(nextRunIdOf(stateRef.current), run.attempt)
      },
      cancel: () => {
        runner.cancel()
        announce('Run cancelled. Your room, students and rules are unchanged.')
      },
      dismissRunProblem: () => dispatch({ type: 'dismissRunProblem' }),
      setMode: (mode) => dispatch({ type: 'setMode', mode }),
      announce,
    }),
    [state, caption, runner, announce],
  )

  return (
    <AppContext.Provider value={api}>
      {children}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </AppContext.Provider>
  )
}
