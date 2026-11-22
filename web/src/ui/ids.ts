/** Opaque ids for desks, markers, students and rules: 1..64 chars of [A-Za-z0-9-] (AD-4). */
export function newId(): string {
  const crypto = globalThis.crypto as Crypto | undefined
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
