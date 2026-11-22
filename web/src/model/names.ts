import { MAX_NAME_LENGTH } from './limits'
import type { Student } from './types'

/** Uniqueness key: trimmed, Unicode-normalized (NFC) and case-folded (FR-10). */
export const nameKey = (name: string): string => name.trim().normalize('NFC').toLowerCase()

export type NameProblem = 'empty' | 'tooLong' | 'duplicate'

export type NameCheck =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: NameProblem }

/** Checks a typed name against the class. The stored name is the trimmed text exactly as entered. */
export function checkName(raw: string, students: readonly Student[], exceptId?: string): NameCheck {
  const name = raw.trim()
  if (name === '') return { ok: false, problem: 'empty' }
  if ([...name].length > MAX_NAME_LENGTH) return { ok: false, problem: 'tooLong' }
  const key = nameKey(name)
  if (students.some((s) => s.id !== exceptId && nameKey(s.name) === key)) {
    return { ok: false, problem: 'duplicate' }
  }
  return { ok: true, name }
}
