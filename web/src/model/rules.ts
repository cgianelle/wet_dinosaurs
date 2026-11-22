import type { Classroom, Rule } from './types'

export type RuleProblem = 'unknownStudent' | 'selfPair' | 'duplicate'

export const ruleStudentIds = (rule: Rule): readonly string[] =>
  rule.type === 'notNear' ? rule.studentIds : [rule.studentId]

/** A rule's meaning: a not-near pair is unordered, so a reversed pair is the same rule (FR-15). */
export function ruleKey(rule: Rule): string {
  return `${rule.type}|${[...ruleStudentIds(rule)].sort().join('|')}`
}

/** What is wrong with `rule` in `classroom`, ignoring the rule with id `exceptId` (for edits). */
export function ruleProblem(classroom: Classroom, rule: Rule, exceptId?: string): RuleProblem | null {
  const known = new Set(classroom.students.map((s) => s.id))
  if (!ruleStudentIds(rule).every((id) => known.has(id))) return 'unknownStudent'
  if (rule.type === 'notNear' && rule.studentIds[0] === rule.studentIds[1]) return 'selfPair'
  const key = ruleKey(rule)
  const clash = classroom.rules.some((r) => r.id !== exceptId && r.id !== rule.id && ruleKey(r) === key)
  return clash ? 'duplicate' : null
}

export interface RuleError {
  readonly ruleId: string
  readonly reason: RuleProblem
}

/** Every rule in the classroom that is invalid, in list order. Normally empty: commands keep it so. */
export function ruleErrors(classroom: Classroom): RuleError[] {
  const seen = new Set<string>()
  const errors: RuleError[] = []
  const known = new Set(classroom.students.map((s) => s.id))
  for (const rule of classroom.rules) {
    const key = ruleKey(rule)
    let reason: RuleProblem | null = null
    if (!ruleStudentIds(rule).every((id) => known.has(id))) reason = 'unknownStudent'
    else if (rule.type === 'notNear' && rule.studentIds[0] === rule.studentIds[1]) reason = 'selfPair'
    else if (seen.has(key)) reason = 'duplicate'
    seen.add(key)
    if (reason) errors.push({ ruleId: rule.id, reason })
  }
  return errors
}
