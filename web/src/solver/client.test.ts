import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '../model/contract'
import { MAX_COLUMNS, MAX_DESKS, MAX_ROWS, MAX_STUDENTS } from '../model/limits'
import { errorEnvelopeSchema, responseSchema } from './schema'
import { solve, type SolveOutcome } from './client'
import type { SolveRequest } from '../model/contract'

const fixtureDir = join(import.meta.dirname, '../../../contract/fixtures')
const readFixture = (name: string): unknown => JSON.parse(readFileSync(join(fixtureDir, name), 'utf8'))

interface Case {
  name: string
  status: number
  request?: string
  response?: string
  error?: string
}
const manifest = readFixture('manifest.json') as { cases: Case[] }

const request: SolveRequest = { grid: { columns: 3, rows: 3 }, frontEdge: 'top', desks: [], students: [], rules: [] }

const replying = (status: number, body: unknown): typeof fetch =>
  (() => Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))) as typeof fetch

describe('contract fixtures', () => {
  it('has at least one valid and every error code covered', () => {
    const codes = new Set(
      manifest.cases.filter((c) => c.error).map((c) => (readFixture(c.error!) as { error: { code: string } }).error.code),
    )
    expect([...codes].sort()).toEqual([...ERROR_CODES].sort())
  })

  it.each(manifest.cases.filter((c) => c.response))('decodes the response of $name through zod', (c) => {
    expect(responseSchema.safeParse(readFixture(c.response!)).success).toBe(true)
  })

  it.each(manifest.cases.filter((c) => c.error))('decodes the error of $name through zod', (c) => {
    expect(errorEnvelopeSchema.safeParse(readFixture(c.error!)).success).toBe(true)
  })

  it('agrees with the client limits module', () => {
    const limitOf = (name: string) => (readFixture(`error-${name}.error.json`) as { error: { limit: number } }).error.limit
    expect(limitOf('limit_exceeded-grid-columns')).toBe(MAX_COLUMNS)
    expect(limitOf('limit_exceeded-grid-rows')).toBe(MAX_ROWS)
    expect(limitOf('limit_exceeded-desks')).toBe(MAX_DESKS)
    expect(limitOf('limit_exceeded-students')).toBe(MAX_STUDENTS)
  })

  it('shows all three outcome kinds in the irregular 50-desk response', () => {
    const response = responseSchema.parse(readFixture('valid-irregular-50.response.json'))
    const kinds = new Set(response.arrangements.flatMap((a) => a.outcomes.map((o) => o.result)))
    expect([...kinds].sort()).toEqual(['met', 'neutral', 'notMet'])
  })
})

describe('solve', () => {
  it('returns the decoded response for a 200 fixture', async () => {
    const body = readFixture('valid-minimal.response.json')
    const outcome = await solve(request, { fetchImpl: replying(200, body) })
    expect(outcome.kind).toBe('ok')
  })

  it('posts the request as JSON to /v1/solve', async () => {
    let seen: { url: string; init?: RequestInit } | undefined
    const fetchImpl = ((url: string, init?: RequestInit) => {
      seen = { url, init }
      return Promise.resolve(new Response(JSON.stringify(readFixture('valid-minimal.response.json')), { status: 200 }))
    }) as typeof fetch
    await solve(request, { fetchImpl })
    expect(seen?.url).toBe('/v1/solve')
    expect(seen?.init?.method).toBe('POST')
    expect(JSON.parse(String(seen?.init?.body))).toEqual(request)
  })

  it.each(manifest.cases.filter((c) => c.error))('maps the $name error fixture to a typed outcome', async (c) => {
    const outcome = await solve(request, { fetchImpl: replying(c.status, readFixture(c.error!)) })
    const code = (readFixture(c.error!) as { error: { code: string } }).error.code
    const expected: SolveOutcome['kind'] = ['busy', 'timeout', 'internal'].includes(code) ? (code as 'busy') : 'rejected'
    expect(outcome.kind).toBe(expected)
    if (outcome.kind === 'rejected') expect(outcome.code).toBe(code)
  })

  it('carries the field and limit of limit_exceeded', async () => {
    const outcome = await solve(request, { fetchImpl: replying(400, readFixture('error-limit_exceeded-desks.error.json')) })
    expect(outcome).toEqual({ kind: 'rejected', code: 'limit_exceeded', field: 'desks', limit: 50 })
  })

  it('fails closed when a 200 body does not match the contract', async () => {
    const outcome = await solve(request, { fetchImpl: replying(200, { arrangements: [{ rank: 1 }] }) })
    expect(outcome.kind).toBe('internal')
  })

  it('treats a network failure as unreachable and an unreadable error page as unreachable', async () => {
    const down = (() => Promise.reject(new TypeError('failed'))) as typeof fetch
    expect((await solve(request, { fetchImpl: down })).kind).toBe('unreachable')
    expect((await solve(request, { fetchImpl: replying(502, '<html>bad gateway</html>') })).kind).toBe('unreachable')
  })

  it('reports a client-side timeout', async () => {
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))) as typeof fetch
    expect((await solve(request, { fetchImpl: hang, timeoutMs: 10 })).kind).toBe('timeout')
  })

  it("rejects with the caller's abort rather than reporting an outcome", async () => {
    const controller = new AbortController()
    const hang = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('x', 'AbortError'))))) as typeof fetch
    const pending = solve(request, { fetchImpl: hang, signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toBeDefined()
  })
})
