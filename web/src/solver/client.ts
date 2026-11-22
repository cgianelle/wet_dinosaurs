import type { ErrorCode, SolveRequest, SolveResponse } from '../model/contract'
import { errorEnvelopeSchema, responseSchema } from './schema'

/** What the planner learns from one Run. Copy for each case lives in the UI layer (FR-25). */
export type SolveOutcome =
  | { readonly kind: 'ok'; readonly response: SolveResponse }
  | { readonly kind: 'rejected'; readonly code: ErrorCode; readonly field?: string; readonly limit?: number }
  | { readonly kind: 'unreachable' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'internal' }

export type SolveFailure = Exclude<SolveOutcome, { kind: 'ok' }>

export interface SolveOptions {
  readonly signal?: AbortSignal
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

/** A little longer than the service's own 30 s limit, so the service's `timeout` normally wins. */
export const CLIENT_TIMEOUT_MS = 40_000
export const SOLVE_URL = '/v1/solve'

/**
 * The only function in the browser that talks to the seating service (FR-26). Rejects with the
 * caller's AbortError when the caller's signal aborts; every other failure is a typed outcome.
 */
export async function solve(request: SolveRequest, options: SolveOptions = {}): Promise<SolveOutcome> {
  const { signal, fetchImpl = fetch, timeoutMs = CLIENT_TIMEOUT_MS } = options
  const timeout = AbortSignal.timeout(timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    const response = await fetchImpl(SOLVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: combined,
    })
    return await interpret(response)
  } catch (error) {
    if (signal?.aborted) throw error
    return timeout.aborted ? { kind: 'timeout' } : { kind: 'unreachable' }
  }
}

async function interpret(response: Response): Promise<SolveOutcome> {
  const body: unknown = await response.json().catch(() => undefined)
  if (response.ok) {
    const parsed = responseSchema.safeParse(body)
    return parsed.success ? { kind: 'ok', response: parsed.data } : { kind: 'internal' }
  }
  const envelope = errorEnvelopeSchema.safeParse(body)
  if (!envelope.success) return { kind: 'unreachable' }
  const { code, field, limit } = envelope.data.error
  switch (code) {
    case 'busy':
    case 'timeout':
    case 'internal':
      return { kind: code }
    default:
      return { kind: 'rejected', code, ...(field ? { field } : {}), ...(limit ? { limit } : {}) }
  }
}
