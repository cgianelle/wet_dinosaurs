import { useState } from 'react'
import { runBlockers } from '../model/blockers'
import { canRedo, canUndo, nextRedoLabel, nextUndoLabel } from '../model/history'
import { isOutOfDate } from '../model/results'
import { useApp } from './AppContext'
import { ReadinessChecklist, type FixTarget } from './ReadinessChecklist'
import { plural } from './text'

export function Header({ onFix }: { onFix: (target: FixTarget) => void }) {
  const app = useApp()
  const { editor, mode, run } = app.state
  const classroom = editor.present
  const [showChecklist, setShowChecklist] = useState(false)
  const blockers = runBlockers(classroom)
  const ready = blockers.length === 0
  const running = run.phase === 'running'
  const hasResults = editor.results !== null
  const outOfDate = editor.results ? isOutOfDate(editor.results, classroom) : false
  const undoLabel = nextUndoLabel(editor)
  const redoLabel = nextRedoLabel(editor)
  const summary = running ? 'Running' : ready ? 'Ready to run' : `${plural(blockers.length, 'thing')} to fix`

  const press = () => {
    if (!app.run()) setShowChecklist(true)
    else setShowChecklist(false)
  }

  return (
    <header className="app-header">
      <h1>DSSeating</h1>
      <div className="undo-redo">
        <button type="button" disabled={!canUndo(editor) || running} aria-label={undoLabel ? `Undo: ${undoLabel}` : 'Undo'} onClick={app.undo}>
          Undo
        </button>
        <button type="button" disabled={!canRedo(editor) || running} aria-label={redoLabel ? `Redo: ${redoLabel}` : 'Redo'} onClick={app.redo}>
          Redo
        </button>
      </div>
      <div role="tablist" aria-label="Mode" className="mode-tabs">
        <button type="button" role="tab" aria-selected={mode === 'plan'} onClick={() => app.setMode('plan')}>
          Plan
        </button>
        <button type="button" role="tab" aria-selected={mode === 'results'} disabled={!hasResults} onClick={() => app.setMode('results')}>
          Results
          {outOfDate && <span className="badge warn">Out of date</span>}
        </button>
      </div>
      <div className="run-area">
        {mode === 'plan' ? (
          <>
            <button type="button" className="summary" aria-expanded={showChecklist} onClick={() => setShowChecklist((v) => !v)}>
              {`${ready || running ? '✓' : '⚠'} ${summary}`}
            </button>
            <button type="button" className="primary run" aria-disabled={!ready || running} onClick={press}>
              {running ? 'Running...' : 'Run'}
            </button>
            {showChecklist && (
              <div className="checklist-popover" role="region" aria-label="Run checklist">
                <ReadinessChecklist
                  classroom={classroom}
                  onFix={(target) => {
                    setShowChecklist(false)
                    onFix(target)
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <button type="button" className="primary" onClick={() => app.setMode('plan')}>
            Edit plan
          </button>
        )}
      </div>
    </header>
  )
}
