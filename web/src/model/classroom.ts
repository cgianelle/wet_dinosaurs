import { doorSpotOnWall, doorsOutside, inGrid, occupantOf, sameCell, sameDoorSpot } from './geometry'
import {
  DEFAULT_GRID,
  MAX_COLUMNS,
  MAX_DESKS,
  MAX_DOORS,
  MAX_ROWS,
  MAX_STUDENTS,
} from './limits'
import { checkName, type NameProblem } from './names'
import { ruleProblem, type RuleProblem } from './rules'
import type { Cell, Classroom, Rule, Student, Wall } from './types'
import { previewFill, type FillRequest } from './bulk'

export const emptyClassroom = (): Classroom => ({
  grid: DEFAULT_GRID,
  frontWall: 'top',
  desks: [],
  teacherDesk: null,
  doors: [],
  students: [],
  rules: [],
})

/** The only ways to change a Classroom (AD-9). Ids are supplied by the caller so the model stays pure. */
export type Command =
  | { readonly type: 'placeDesk'; readonly id: string; readonly cell: Cell }
  | { readonly type: 'moveDesk'; readonly id: string; readonly to: Cell }
  | { readonly type: 'removeDesk'; readonly id: string }
  | { readonly type: 'setFrontWall'; readonly wall: Wall }
  | { readonly type: 'placeTeacherDesk'; readonly id: string; readonly cell: Cell }
  | { readonly type: 'moveTeacherDesk'; readonly to: Cell }
  | { readonly type: 'removeTeacherDesk' }
  | { readonly type: 'placeDoor'; readonly id: string; readonly wall: Wall; readonly index: number }
  | { readonly type: 'moveDoor'; readonly id: string; readonly wall: Wall; readonly index: number }
  | { readonly type: 'removeDoor'; readonly id: string }
  | { readonly type: 'resizeGrid'; readonly columns: number; readonly rows: number; readonly confirmed?: boolean }
  | ({ readonly type: 'fillRoom' } & FillRequest & { readonly ids: readonly string[] })
  | { readonly type: 'addStudent'; readonly id: string; readonly name: string }
  | { readonly type: 'addStudents'; readonly students: readonly Student[] }
  | { readonly type: 'editStudent'; readonly id: string; readonly name: string }
  | { readonly type: 'removeStudent'; readonly id: string }
  | { readonly type: 'addRule'; readonly rule: Rule }
  | { readonly type: 'editRule'; readonly rule: Rule }
  | { readonly type: 'removeRule'; readonly id: string }
  | { readonly type: 'startOver' }

export type Rejection =
  | { readonly reason: 'cellOccupied' }
  | { readonly reason: 'outOfGrid' }
  | { readonly reason: 'deskLimit' }
  | { readonly reason: 'teacherDeskLimit' }
  | { readonly reason: 'doorLimit' }
  | { readonly reason: 'doorSpotTaken' }
  | { readonly reason: 'doorOffWall' }
  | { readonly reason: 'unknownItem' }
  | { readonly reason: 'gridLimit'; readonly field: 'grid.columns' | 'grid.rows' }
  | { readonly reason: 'gridTooSmall' }
  | { readonly reason: 'resizeRemoves'; readonly desks: number; readonly teacherDesk: boolean; readonly doors: number }
  | { readonly reason: 'studentLimit' }
  | { readonly reason: 'invalidName'; readonly problem: NameProblem }
  | { readonly reason: 'nothingToAdd' }
  | { readonly reason: 'invalidRule'; readonly problem: RuleProblem }
  | { readonly reason: 'fillRejected' }

/** Facts about an accepted command that the UI announces. */
export interface CommandInfo {
  readonly removedRules?: number
  readonly removedDesks?: number
  readonly removedTeacherDesk?: boolean
  readonly removedDoors?: number
  readonly added?: readonly Student[]
  readonly skippedNames?: readonly string[]
}

export type CommandResult =
  | { readonly ok: true; readonly classroom: Classroom; readonly info: CommandInfo }
  | { readonly ok: false; readonly rejection: Rejection }

const accept = (classroom: Classroom, info: CommandInfo = {}): CommandResult => ({ ok: true, classroom, info })
const reject = (rejection: Rejection): CommandResult => ({ ok: false, rejection })

/** The one reducer. Pure: same classroom and command give the same result. */
export function applyCommand(c: Classroom, command: Command): CommandResult {
  switch (command.type) {
    case 'placeDesk':
      return placeDesk(c, command.id, command.cell)
    case 'moveDesk':
      return moveDesk(c, command.id, command.to)
    case 'removeDesk':
      return c.desks.some((d) => d.id === command.id)
        ? accept({ ...c, desks: c.desks.filter((d) => d.id !== command.id) })
        : reject({ reason: 'unknownItem' })
    case 'setFrontWall':
      return accept({ ...c, frontWall: command.wall })
    case 'placeTeacherDesk':
      return placeTeacherDesk(c, command.id, command.cell)
    case 'moveTeacherDesk':
      return moveTeacherDesk(c, command.to)
    case 'removeTeacherDesk':
      return c.teacherDesk ? accept({ ...c, teacherDesk: null }) : reject({ reason: 'unknownItem' })
    case 'placeDoor':
      return placeDoor(c, command.id, command.wall, command.index)
    case 'moveDoor':
      return moveDoor(c, command.id, command.wall, command.index)
    case 'removeDoor':
      return c.doors.some((d) => d.id === command.id)
        ? accept({ ...c, doors: c.doors.filter((d) => d.id !== command.id) })
        : reject({ reason: 'unknownItem' })
    case 'resizeGrid':
      return resizeGrid(c, command.columns, command.rows, command.confirmed === true)
    case 'fillRoom':
      return fillRoom(c, command)
    case 'addStudent':
      return addStudents(c, [{ id: command.id, name: command.name }])
    case 'addStudents':
      return addStudents(c, command.students)
    case 'editStudent':
      return editStudent(c, command.id, command.name)
    case 'removeStudent':
      return removeStudent(c, command.id)
    case 'addRule':
      return addRule(c, command.rule)
    case 'editRule':
      return editRule(c, command.rule)
    case 'removeRule':
      return c.rules.some((r) => r.id === command.id)
        ? accept({ ...c, rules: c.rules.filter((r) => r.id !== command.id) })
        : reject({ reason: 'unknownItem' })
    case 'startOver':
      return accept(emptyClassroom())
  }
}

/** Closed-union label of a command, for "Undo: remove desk" (AD-9). */
export function commandLabel(command: Command): string {
  const labels: Record<Command['type'], string> = {
    placeDesk: 'add desk',
    moveDesk: 'move desk',
    removeDesk: 'remove desk',
    setFrontWall: 'change front wall',
    placeTeacherDesk: "place teacher's desk",
    moveTeacherDesk: "move teacher's desk",
    removeTeacherDesk: "remove teacher's desk",
    placeDoor: 'place door',
    moveDoor: 'move door',
    removeDoor: 'remove door',
    resizeGrid: 'resize room',
    fillRoom: 'fill room',
    addStudent: 'add student',
    addStudents: 'add students',
    editStudent: 'rename student',
    removeStudent: 'remove student',
    addRule: 'add rule',
    editRule: 'edit rule',
    removeRule: 'remove rule',
    startOver: 'start over',
  }
  return labels[command.type]
}

function cellProblem(c: Classroom, cell: Cell, ignoreId?: string): Rejection | null {
  if (!inGrid(c.grid, cell)) return { reason: 'outOfGrid' }
  const occupant = occupantOf(c, cell)
  return occupant && occupant.id !== ignoreId ? { reason: 'cellOccupied' } : null
}

function placeDesk(c: Classroom, id: string, cell: Cell): CommandResult {
  const problem = cellProblem(c, cell)
  if (problem) return reject(problem)
  if (c.desks.length >= MAX_DESKS) return reject({ reason: 'deskLimit' })
  return accept({ ...c, desks: [...c.desks, { id, cell }] })
}

function moveDesk(c: Classroom, id: string, to: Cell): CommandResult {
  if (!c.desks.some((d) => d.id === id)) return reject({ reason: 'unknownItem' })
  const problem = cellProblem(c, to)
  if (problem) return reject(problem)
  return accept({ ...c, desks: c.desks.map((d) => (d.id === id ? { ...d, cell: to } : d)) })
}

function placeTeacherDesk(c: Classroom, id: string, cell: Cell): CommandResult {
  const problem = cellProblem(c, cell)
  if (problem) return reject(problem)
  if (c.teacherDesk) return reject({ reason: 'teacherDeskLimit' })
  return accept({ ...c, teacherDesk: { id, cell } })
}

function moveTeacherDesk(c: Classroom, to: Cell): CommandResult {
  if (!c.teacherDesk) return reject({ reason: 'unknownItem' })
  const problem = cellProblem(c, to, c.teacherDesk.id)
  if (problem) return reject(problem)
  return accept({ ...c, teacherDesk: { ...c.teacherDesk, cell: to } })
}

function doorSpotProblem(c: Classroom, wall: Wall, index: number, ignoreId?: string): Rejection | null {
  if (!doorSpotOnWall(c.grid, wall, index)) return { reason: 'doorOffWall' }
  return c.doors.some((d) => d.id !== ignoreId && sameDoorSpot(d, { wall, index })) ? { reason: 'doorSpotTaken' } : null
}

function placeDoor(c: Classroom, id: string, wall: Wall, index: number): CommandResult {
  const problem = doorSpotProblem(c, wall, index)
  if (problem) return reject(problem)
  if (c.doors.length >= MAX_DOORS) return reject({ reason: 'doorLimit' })
  return accept({ ...c, doors: [...c.doors, { id, wall, index }] })
}

function moveDoor(c: Classroom, id: string, wall: Wall, index: number): CommandResult {
  if (!c.doors.some((d) => d.id === id)) return reject({ reason: 'unknownItem' })
  const problem = doorSpotProblem(c, wall, index, id)
  if (problem) return reject(problem)
  return accept({ ...c, doors: c.doors.map((d) => (d.id === id ? { ...d, wall, index } : d)) })
}

/** What shrinking to `columns` x `rows` would cut off. */
export function resizeLoss(c: Classroom, columns: number, rows: number) {
  const grid = { columns, rows }
  return {
    desks: c.desks.filter((d) => !inGrid(grid, d.cell)),
    teacherDesk: c.teacherDesk && !inGrid(grid, c.teacherDesk.cell) ? c.teacherDesk : null,
    doors: doorsOutside(c.doors, grid),
  }
}

function resizeGrid(c: Classroom, columns: number, rows: number, confirmed: boolean): CommandResult {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
    return reject({ reason: 'gridTooSmall' })
  }
  if (columns > MAX_COLUMNS) return reject({ reason: 'gridLimit', field: 'grid.columns' })
  if (rows > MAX_ROWS) return reject({ reason: 'gridLimit', field: 'grid.rows' })
  const lost = resizeLoss(c, columns, rows)
  if ((lost.desks.length > 0 || lost.teacherDesk || lost.doors.length > 0) && !confirmed) {
    return reject({ reason: 'resizeRemoves', desks: lost.desks.length, teacherDesk: lost.teacherDesk !== null, doors: lost.doors.length })
  }
  const removedDesks = new Set(lost.desks.map((d) => d.id))
  const removedDoors = new Set(lost.doors.map((d) => d.id))
  return accept(
    {
      ...c,
      grid: { columns, rows },
      desks: c.desks.filter((d) => !removedDesks.has(d.id)),
      teacherDesk: lost.teacherDesk ? null : c.teacherDesk,
      doors: c.doors.filter((d) => !removedDoors.has(d.id)),
    },
    { removedDesks: lost.desks.length, removedTeacherDesk: lost.teacherDesk !== null, removedDoors: lost.doors.length },
  )
}

function fillRoom(c: Classroom, command: FillRequest & { readonly ids: readonly string[] }): CommandResult {
  const preview = previewFill(c, command)
  if (!preview.ok) return reject({ reason: 'fillRejected' })
  const freeCells = preview.cells.filter((cell) => !c.desks.some((d) => sameCell(d.cell, cell)))
  if (command.ids.length < freeCells.length) return reject({ reason: 'fillRejected' })
  const fresh = freeCells.map((cell, i) => ({ id: command.ids[i] as string, cell }))
  return accept({ ...c, desks: [...c.desks, ...fresh] })
}

function addStudents(c: Classroom, incoming: readonly Student[]): CommandResult {
  const students = [...c.students]
  const added: Student[] = []
  const skippedNames: string[] = []
  let firstProblem: NameProblem | null = null
  for (const candidate of incoming) {
    const check = checkName(candidate.name, students)
    if (!check.ok) {
      firstProblem ??= check.problem
      skippedNames.push(candidate.name.trim())
      continue
    }
    const student = { id: candidate.id, name: check.name }
    students.push(student)
    added.push(student)
  }
  if (added.length === 0) {
    return reject(incoming.length === 1 && firstProblem ? { reason: 'invalidName', problem: firstProblem } : { reason: 'nothingToAdd' })
  }
  if (students.length > MAX_STUDENTS) return reject({ reason: 'studentLimit' })
  return accept({ ...c, students }, { added, skippedNames })
}

function editStudent(c: Classroom, id: string, name: string): CommandResult {
  if (!c.students.some((s) => s.id === id)) return reject({ reason: 'unknownItem' })
  const check = checkName(name, c.students, id)
  if (!check.ok) return reject({ reason: 'invalidName', problem: check.problem })
  return accept({ ...c, students: c.students.map((s) => (s.id === id ? { ...s, name: check.name } : s)) })
}

function removeStudent(c: Classroom, id: string): CommandResult {
  if (!c.students.some((s) => s.id === id)) return reject({ reason: 'unknownItem' })
  const rules = c.rules.filter((r) => !(r.type === 'notNear' ? r.studentIds.includes(id) : r.studentId === id))
  return accept(
    { ...c, students: c.students.filter((s) => s.id !== id), rules },
    { removedRules: c.rules.length - rules.length },
  )
}

function addRule(c: Classroom, rule: Rule): CommandResult {
  const problem = ruleProblem(c, rule)
  return problem ? reject({ reason: 'invalidRule', problem }) : accept({ ...c, rules: [...c.rules, rule] })
}

function editRule(c: Classroom, rule: Rule): CommandResult {
  if (!c.rules.some((r) => r.id === rule.id)) return reject({ reason: 'unknownItem' })
  const problem = ruleProblem(c, rule, rule.id)
  if (problem) return reject({ reason: 'invalidRule', problem })
  return accept({ ...c, rules: c.rules.map((r) => (r.id === rule.id ? rule : r)) })
}
