import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('FR-26: the browser reaches the service only through src/solver', () => {
  const root = import.meta.dirname
  const networkUse = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/

  it('uses fetch and friends nowhere else', () => {
    const offenders = sourceFiles(root)
      .filter((file) => !relative(root, file).startsWith('solver') && !/\.test\.tsx?$/.test(file))
      .filter((file) => networkUse.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
    expect(offenders).toEqual([])
  })

  it('keeps the model free of React, the DOM and the network', () => {
    const offenders = sourceFiles(join(root, 'model'))
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => /from 'react|from '\.\.\/(ui|state|solver)|document\.|window\./.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
    expect(offenders).toEqual([])
  })

  it('stores nothing in the browser (AD-9)', () => {
    const offenders = sourceFiles(root)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => /localStorage|sessionStorage|indexedDB|document\.cookie/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file))
    expect(offenders).toEqual([])
  })
})
