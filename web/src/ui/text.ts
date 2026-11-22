import type { Blocker } from '../model/blockers'
import type { Command, Rejection } from '../model/classroom'
import type { Outcome, OutcomeResult } from '../model/contract'
import type { Feedback } from '../model/history'
import { limitMessage, MAX_NAME_LENGTH, MAX_STUDENTS } from '../model/limits'
import type { RuleProblem } from '../model/rules'
import type { Classroom, MarkerKind, Rule, RuleType } from '../model/types'
import type { SolveFailure } from '../solver/client'

export const MARKER_LABELS: Readonly<Record<MarkerKind, string>> = {
  front: 'Front',
  back: 'Back',
  side: 'Side',
  door: 'Door',
  teacherDesk: "Teacher's desk",
}

export const RULE_TYPE_LABELS: Readonly<Record<RuleType, string>> = {
  front: 'Front',
  notNear: 'Not near',
  isle: 'Isle',
}

export const RULE_TYPE_GLOSS: Readonly<Record<RuleType, string>> = {
  front: 'Sits near the front of the room.',
  notNear: 'Two students should not sit near each other.',
  isle: 'Sits in an outside column, next to a wall (an aisle seat).',
}

export const HOW_RULES_ARE_JUDGED = [
  'Front: rows are counted from the front-most desk row. Each row gets a score that runs from best at the front to worst at the back. A row above zero is Met, a row at exactly zero is Neutral, a row below zero is Not met. Neutral only happens in rooms with an odd number of desk rows (3 or more). In a 5-row room, rows 1 and 2 are Met, row 3 Neutral, rows 4 and 5 Not met.',
  'Not near: near means 2 desk steps or fewer (rows plus columns; gaps count; diagonal neighbours and two desks apart in a row are near). Met only when they are more than 2 steps apart.',
  'Isle: met when the student sits in the leftmost or rightmost column that has a desk.',
] as const

export type NameOf = (studentId: string) => string

export function nameLookup(classroom: Classroom): NameOf {
  const names = new Map(classroom.students.map((s) => [s.id, s.name]))
  return (id) => names.get(id) ?? 'A removed student'
}

export function ruleSentence(rule: Rule, nameOf: NameOf): string {
  switch (rule.type) {
    case 'front':
      return `${nameOf(rule.studentId)} sits near the front`
    case 'isle':
      return `${nameOf(rule.studentId)} sits on an Isle (outside column)`
    case 'notNear':
      return `${nameOf(rule.studentIds[0])} and ${nameOf(rule.studentIds[1])} do not sit near each other`
  }
}

export function ruleProblemMessage(problem: RuleProblem, rule: Rule, nameOf: NameOf): string {
  switch (problem) {
    case 'duplicate':
      return rule.type === 'notNear'
        ? `${nameOf(rule.studentIds[0])} and ${nameOf(rule.studentIds[1])} already have a Not near rule.`
        : `${nameOf(rule.studentId)} already has ${rule.type === 'front' ? 'a Front' : 'an Isle'} rule.`
    case 'selfPair':
      return 'Choose two different students.'
    case 'unknownStudent':
      return 'This rule names a student who was removed.'
  }
}

export function nameProblemMessage(problem: 'empty' | 'tooLong' | 'duplicate', typed: string): string {
  switch (problem) {
    case 'empty':
      return 'Enter a name.'
    case 'tooLong':
      return `Names can be up to ${MAX_NAME_LENGTH} characters.`
    case 'duplicate':
      return `There is already a student named '${typed.trim()}' (names are compared without regard to case or accent encoding).`
  }
}

/** Plain-language text for a command the model refused (UX S1-S3). */
export function rejectionMessage(rejection: Rejection, command: Command, classroom: Classroom): string {
  switch (rejection.reason) {
    case 'cellOccupied':
      return command.type === 'moveDesk' || command.type === 'placeDesk'
        ? 'That cell already has a desk. Desk returned.'
        : 'That cell is already taken. Item returned.'
    case 'outOfGrid':
      return 'That spot is outside the room.'
    case 'deskLimit':
      return limitMessage('desks')
    case 'markerLimit':
      return 'Already placed. Move or remove it.'
    case 'frontNotOnEdge':
      return 'The Front marker goes on the edge of the room, not in a corner or the middle.'
    case 'unknownItem':
      return 'That item is no longer in the room.'
    case 'gridLimit':
      return limitMessage(rejection.field)
    case 'gridTooSmall':
      return 'Rooms need at least 1 column and 1 row.'
    case 'resizeRemoves':
      return 'Shrinking the room would remove some desks or markers.'
    case 'studentLimit':
      return limitMessage('students')
    case 'invalidName':
      return nameProblemMessage(rejection.problem, 'name' in command ? String(command.name) : '')
    case 'nothingToAdd':
      return 'There are no new names to add.'
    case 'invalidRule':
      return 'rule' in command ? ruleProblemMessage(rejection.problem, command.rule, nameLookup(classroom)) : 'That rule is not valid.'
    case 'fillRejected':
      return 'That block of desks does not fit in the room.'
  }
}

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

/** What the live region and caption say after an editor action. */
export function feedbackMessage(feedback: Feedback, classroom: Classroom, before: Classroom): string {
  if (feedback.kind === 'rejected') return rejectionMessage(feedback.rejection, feedback.command, before)
  if (feedback.kind !== 'accepted') return `${feedback.kind === 'undone' ? 'Undone' : 'Redone'}: ${feedback.label}.`
  const desks = plural(classroom.desks.length, 'desk')
  switch (feedback.label) {
    case 'add desk':
      return `Desk added. ${desks}.`
    case 'move desk':
      return 'Desk moved.'
    case 'remove desk':
      return `Desk removed. ${desks}.`
    case 'fill room':
      return `Room filled. ${desks}.`
    case 'add student':
    case 'add students': {
      const added = feedback.info.added ?? []
      const skipped = feedback.info.skippedNames?.length ?? 0
      const who = added.length === 1 ? `${added[0]?.name} added` : `${added.length} students added`
      return `${who}${skipped ? `, ${skipped} skipped` : ''}. ${classroom.students.length} of ${MAX_STUDENTS}.`
    }
    case 'remove student': {
      const rules = feedback.info.removedRules ?? 0
      return `Student removed${rules ? ` along with ${plural(rules, 'rule')}` : ''}. ${classroom.students.length} of ${MAX_STUDENTS}.`
    }
    case 'add rule':
      return `Rule added: ${classroom.rules.at(-1) ? ruleSentence(classroom.rules.at(-1) as Rule, nameLookup(classroom)) : ''}.`
    case 'remove rule':
      return 'Rule removed.'
    case 'edit rule':
      return 'Rule updated.'
    case 'rename student':
      return 'Student renamed.'
    case 'place marker':
      return 'Marker placed.'
    case 'move marker':
      return 'Marker moved.'
    case 'remove marker':
      return 'Marker removed.'
    case 'resize room':
      return `Room resized to ${classroom.grid.columns} by ${classroom.grid.rows}.`
    case 'start over':
      return 'Started over. The room, students and rules are cleared.'
    default:
      return `Done: ${feedback.label}.`
  }
}

export function blockerText(blocker: Blocker): string {
  switch (blocker.kind) {
    case 'noStudents':
      return 'Add at least 1 student.'
    case 'countMismatch': {
      const { students, desks } = blocker
      const gap = Math.abs(desks - students)
      const fix =
        desks > students
          ? `Add ${plural(gap, 'student')} or remove ${plural(gap, 'desk')}.`
          : `Remove ${plural(gap, 'student')} or add ${plural(gap, 'desk')}.`
      return `${plural(desks, 'desk')}, ${plural(students, 'student')}. ${fix}`
    }
    case 'noFrontMarker':
      return 'Place the Front marker on a cell at the edge of the room.'
    case 'frontMarkerNotOnEdge':
      return 'Move the Front marker to the edge of the room, not a corner.'
    case 'ruleError':
      return '1 rule needs attention.'
  }
}

export function failureMessage(failure: SolveFailure): string {
  switch (failure.kind) {
    case 'unreachable':
      return "We can't reach the seating service. Check your connection and try again."
    case 'timeout':
      return 'The seating service took too long. Try again.'
    case 'busy':
      return "We couldn't get seating plans because the seating service is busy right now. Your room, students and rules are still here."
    case 'rejected':
      return `The seating service couldn't use this room: ${rejectedReason(failure)}. Your room, students and rules are still here.`
    case 'internal':
      return 'Something went wrong on our side. Try again.'
  }
}

function rejectedReason(failure: Extract<SolveFailure, { kind: 'rejected' }>): string {
  switch (failure.code) {
    case 'limit_exceeded':
      return failure.field === 'desks' || failure.field === 'students' || failure.field === 'grid.columns' || failure.field === 'grid.rows'
        ? limitMessage(failure.field).replace(/\.$/, '')
        : 'the room is over a limit'
    case 'count_mismatch':
      return 'the number of students and desks differ'
    case 'no_students':
      return 'there are no students'
    case 'invalid_front_edge':
      return 'the Front marker is not on an edge'
    default:
      return 'something in it was not accepted'
  }
}

export const OUTCOME_LABEL: Readonly<Record<OutcomeResult, string>> = {
  met: 'Met',
  neutral: 'Neutral',
  notMet: 'Not met',
}

export const OUTCOME_ICON: Readonly<Record<OutcomeResult, string>> = {
  met: '✓',
  neutral: '–',
  notMet: '⚠',
}

/** The reason line of an outcome, built only from service data (FR-35). */
export function reasonText(rule: Rule, outcome: Outcome, nameOf: NameOf): string {
  const { detail } = outcome
  switch (rule.type) {
    case 'front':
      return `${nameOf(rule.studentId)} sits in row ${detail.row ?? '?'} of ${detail.rows ?? '?'}`
    case 'notNear': {
      const distance = detail.distance ?? 0
      return `${nameOf(rule.studentIds[0])} sits ${plural(distance, 'desk')} from ${nameOf(rule.studentIds[1])}`
    }
    case 'isle':
      return `${nameOf(rule.studentId)} sits in column ${detail.column ?? '?'} of ${detail.columns ?? '?'}${outcome.result === 'met' ? ', an outside column' : ', not an outside column'}`
  }
}

export const distanceLabel = (distance: number): string => `${plural(distance, 'desk')} apart`

export { plural }
