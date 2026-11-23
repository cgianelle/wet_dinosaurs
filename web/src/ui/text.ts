import type { Blocker } from '../model/blockers'
import type { Command, Rejection } from '../model/classroom'
import type { Outcome, OutcomeResult } from '../model/contract'
import type { Feedback } from '../model/history'
import { isLimitField, limitMessage, MAX_NAME_LENGTH, MAX_STUDENTS } from '../model/limits'
import type { RuleProblem } from '../model/rules'
import { wallRoles } from '../model/geometry'
import type { Classroom, Rule, RuleType, Wall, WallRole } from '../model/types'
import type { SolveFailure } from '../solver/client'

export const WALL_ROLE_LABELS: Readonly<Record<WallRole, string>> = {
  front: 'Front of room',
  back: 'Back of room',
  side: 'Side wall',
}

export const WALL_NAMES: Readonly<Record<Wall, string>> = { top: 'top', bottom: 'bottom', left: 'left', right: 'right' }

export const WALL_CHOICES: readonly { readonly wall: Wall; readonly label: string }[] = [
  { wall: 'top', label: 'Top' },
  { wall: 'bottom', label: 'Bottom' },
  { wall: 'left', label: 'Left' },
  { wall: 'right', label: 'Right' },
]

const OPPOSITE_WALL: Readonly<Record<Wall, Wall>> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

const ROW_DIRECTION: Readonly<Record<Wall, string>> = {
  top: 'rows count down from it',
  bottom: 'rows count up from it',
  left: 'rows count from left to right',
  right: 'rows count from right to left',
}

/** The sentence under "How rules are judged" that names the current front wall (UX S3). */
export const frontWallSentence = (wall: Wall): string => `Your front wall is the ${wall} wall: ${ROW_DIRECTION[wall]}.`

/** The label a wall band carries, derived from the front wall. */
export const wallLabel = (frontWall: Wall, wall: Wall): string => WALL_ROLE_LABELS[wallRoles(frontWall)[wall]]

/** Announced when the front wall changes (UX S1). */
export const frontWallAnnouncement = (wall: Wall): string =>
  `Front wall is now the ${wall} wall. Back is the ${OPPOSITE_WALL[wall]} wall. Rules now count rows from the ${wall}.`

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
  'Front: rows are lines of desks parallel to the front wall, counted outward from it, so they follow the front wall, not the screen. Row 1 is the row of desks nearest the front wall; rows with no desks are not counted. Each row gets a score that runs from best at the front to worst at the back, stretched to fit the number of rows in your room. A row above zero is Met, a row at exactly zero is Neutral, a row below zero is Not met. For example, in a room with 5 rows of desks, rows 1 and 2 are Met, row 3 is Neutral, rows 4 and 5 are Not met.',
  'Not near: near means 2 desk steps or fewer (rows plus columns; gaps count; diagonal neighbours and two desks apart in a row are near). Met only when they are more than 2 steps apart. It does not depend on the front wall.',
  'Isle: an outside column is one of the two outermost lines of desks running away from the front wall, the ones nearest the two side walls. Met when the student sits in either. With the front wall at the top or bottom, these are the leftmost and rightmost columns that have a desk. With the front wall on the left or right, they are the topmost and bottommost rows that have a desk. The teacher\'s desk does not count.',
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
    case 'doorSpotTaken':
    case 'doorOffWall':
      return 'A door goes on a free spot on a wall.'
    case 'doorLimit':
    case 'teacherDeskLimit':
      return 'Already placed. Move or remove it.'
    case 'outOfGrid':
      return 'That spot is outside the room.'
    case 'deskLimit':
      return limitMessage('desks')
    case 'unknownItem':
      return 'That item is no longer in the room.'
    case 'gridLimit':
      return limitMessage(rejection.field)
    case 'gridTooSmall':
      return 'Rooms need at least 1 column and 1 row.'
    case 'resizeRemoves':
      return "Shrinking the room would remove some desks, doors or the teacher's desk."
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
    case "place teacher's desk":
      return "Teacher's desk placed."
    case "move teacher's desk":
      return "Teacher's desk moved."
    case "remove teacher's desk":
      return "Teacher's desk removed."
    case 'place door':
      return `Door added. ${plural(classroom.doors.length, 'door')}.`
    case 'move door':
      return 'Door moved.'
    case 'remove door':
      return 'Door removed.'
    case 'change front wall':
      return frontWallAnnouncement(classroom.frontWall)
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
    case 'ruleError':
      return '1 rule needs attention.'
  }
}

/** One variant per client error-union member (W-7, UX S6). Details are shown only under "Show details". */
export function failureMessage(failure: SolveFailure): string {
  switch (failure.kind) {
    case 'unreachable':
      return "We can't reach the seating service. Check your connection and try again."
    case 'timeout':
      return 'The seating service took too long. Try again.'
    case 'busy':
      return 'The seating service is busy right now. Try again in a moment.'
    case 'rejected':
      return failure.code === 'limit_exceeded' && isLimitField(failure.field)
        ? `${limitMessage(failure.field)} Try again.`
        : 'Something went wrong on our side. Try again.'
    case 'internal':
      return 'Something went wrong on our side. Try again.'
  }
}

/** The technical lines behind "Show details": the error code, and the field when there is one. */
export function failureDetails(failure: SolveFailure): string {
  if (failure.kind !== 'rejected') return `Error: ${failure.kind}`
  return `Error code: ${failure.code}${failure.field ? `. Field: ${failure.field}` : ''}`
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
      return `${nameOf(rule.studentId)} sits in row ${detail.row ?? '?'} of ${detail.rows ?? '?'}, counting from the front wall`
    case 'notNear': {
      const distance = detail.distance ?? 0
      return `${nameOf(rule.studentIds[0])} sits ${plural(distance, 'desk')} from ${nameOf(rule.studentIds[1])}`
    }
    case 'isle':
      return `${nameOf(rule.studentId)} sits in column ${detail.column ?? '?'} of ${detail.columns ?? '?'} along the front wall${outcome.result === 'met' ? ', an outside column' : ', not an outside column'}`
  }
}

export const distanceLabel = (distance: number): string => `${plural(distance, 'desk')} apart`

export { plural }
