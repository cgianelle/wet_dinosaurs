import { solve, type SolveOptions, type SolveOutcome } from '../solver/client'
import type { AppAction } from './app'
import type { RunAttempt } from './run'

type Solve = (request: RunAttempt['request'], options: SolveOptions) => Promise<SolveOutcome>

/**
 * Drives one Run at a time against the service: starts it, aborts it on Cancel and reports the
 * outcome tagged with its runId. A cancelled run's late answer is dropped here and, as a second
 * guard, by the reducer (AD-8).
 */
export function createRunner(dispatch: (action: AppAction) => void, send: Solve = solve) {
  let active: { runId: number; controller: AbortController } | null = null

  return {
    start(runId: number, attempt: RunAttempt): void {
      active?.controller.abort()
      const controller = new AbortController()
      active = { runId, controller }
      dispatch({ type: 'startRun', runId, attempt })
      send(attempt.request, { signal: controller.signal }).then(
        (outcome) => {
          if (controller.signal.aborted) return
          dispatch(
            outcome.kind === 'ok'
              ? { type: 'runSucceeded', runId, response: outcome.response }
              : { type: 'runFailed', runId, failure: outcome },
          )
        },
        () => {
          // Aborted by Cancel: nothing to report.
        },
      )
    },
    cancel(): void {
      active?.controller.abort()
      active = null
      dispatch({ type: 'cancelRun' })
    },
  }
}
