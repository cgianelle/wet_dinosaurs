import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Arrangement, Outcome, OutcomeResult } from '../model/contract'
import { fewestBrokenOption, formatScore, isOutOfDate, type RunResult } from '../model/results'
import { ruleStudentIds } from '../model/rules'
import type { Classroom, Rule } from '../model/types'
import { useApp } from './AppContext'
import { HowRulesAreJudged } from './RulesPanel'
import { RoomCanvas, type DeskInfo } from './RoomCanvas'
import { OUTCOME_ICON, OUTCOME_LABEL, distanceLabel, nameLookup, plural, reasonText, ruleSentence } from './text'

const GROUP_ORDER: readonly OutcomeResult[] = ['notMet', 'neutral', 'met']

/** The primary metric of an option: "9 of 10 rules met", plus the Neutral breakdown (FR-36). */
export function metricText(a: Arrangement): string {
  if (a.rulesTotal === 0) return 'No rules to meet'
  const neutral = a.outcomes.filter((o) => o.result === 'neutral').length
  const base = a.rulesMet === a.rulesTotal ? `All ${plural(a.rulesTotal, 'rule')} met` : `${a.rulesMet} of ${a.rulesTotal} rules met`
  return neutral > 0 ? `${base} (${neutral} Neutral)` : base
}

function deskInfoFor(result: RunResult, arrangement: Arrangement): Map<string, DeskInfo> {
  const { snapshot } = result
  const nameOf = nameLookup(snapshot)
  const deskOf = new Map(arrangement.assignments.map((a) => [a.studentId, a.deskId]))
  const marks = new Map<string, 'notMet' | 'neutral'>()
  for (const outcome of arrangement.outcomes) {
    if (outcome.result === 'met') continue
    const rule = snapshot.rules.find((r) => r.id === outcome.ruleId)
    if (!rule) continue
    for (const studentId of ruleStudentIds(rule)) {
      const deskId = deskOf.get(studentId)
      if (deskId && marks.get(deskId) !== 'notMet') marks.set(deskId, outcome.result)
    }
  }
  const involvement = new Map<string, number>()
  for (const outcome of arrangement.outcomes) {
    const rule = snapshot.rules.find((r) => r.id === outcome.ruleId)
    if (rule && outcome.result !== 'met') for (const id of ruleStudentIds(rule)) involvement.set(id, (involvement.get(id) ?? 0) + 1)
  }
  const info = new Map<string, DeskInfo>()
  for (const assignment of arrangement.assignments) {
    const desk = snapshot.desks.find((d) => d.id === assignment.deskId)
    const name = nameOf(assignment.studentId)
    const mark = marks.get(assignment.deskId) ?? null
    const problems = involvement.get(assignment.studentId) ?? 0
    const status = mark === 'notMet' ? `${plural(problems, 'rule')} not met.` : mark === 'neutral' ? 'Neutral.' : 'All rules met.'
    if (desk) info.set(desk.id, { name, mark, label: `${name}. ${status}` })
  }
  return info
}

export function ResultsView() {
  const app = useApp()
  const result = app.state.editor.results
  const [optionIndex, setOptionIndex] = useState(0)
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [selectedDeskId, setSelectedDeskId] = useState<string | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const arrangement = result?.arrangements[Math.min(optionIndex, (result?.arrangements.length ?? 1) - 1)]
  const deskInfo = useMemo(() => (result && arrangement ? deskInfoFor(result, arrangement) : new Map<string, DeskInfo>()), [result, arrangement])
  if (!result) return null

  const outOfDate = isOutOfDate(result, app.state.editor.present)
  const { snapshot } = result
  const nameOf = nameLookup(snapshot)

  if (!arrangement) {
    return (
      <main className="results">
        <h2>Seating plans</h2>
        <p className="notice">No seating plan could be produced. Try again, or check your rules.</p>
        <button type="button" onClick={() => app.setMode('plan')}>
          Edit plan
        </button>
      </main>
    )
  }

  const assignmentOf = new Map(arrangement.assignments.map((a) => [a.studentId, a.deskId]))
  const selectedRule = snapshot.rules.find((r) => r.id === selectedRuleId)
  const selectedOutcome = arrangement.outcomes.find((o) => o.ruleId === selectedRuleId)
  const highlighted: Set<string> | null = selectedRule
    ? new Set(ruleStudentIds(selectedRule).flatMap((id) => assignmentOf.get(id) ?? []))
    : null
  const line =
    selectedRule?.type === 'notNear' && selectedOutcome?.detail.distance
      ? {
          from: assignmentOf.get(selectedRule.studentIds[0]) ?? '',
          to: assignmentOf.get(selectedRule.studentIds[1]) ?? '',
          label: distanceLabel(selectedOutcome.detail.distance),
        }
      : null
  const selectedDesk = selectedDeskId ? snapshot.desks.find((d) => d.id === selectedDeskId) : undefined
  const selectedStudentId = selectedDeskId ? arrangement.assignments.find((a) => a.deskId === selectedDeskId)?.studentId : undefined

  const rows = arrangement.outcomes.flatMap((outcome) => {
    const rule = snapshot.rules.find((r) => r.id === outcome.ruleId)
    if (!rule) return []
    if (selectedStudentId && !ruleStudentIds(rule).includes(selectedStudentId)) return []
    return [{ rule, outcome }]
  })
  const counts = GROUP_ORDER.map((g) => [g, arrangement.outcomes.filter((o) => o.result === g).length] as const).filter(([, n]) => n > 0)
  const best = fewestBrokenOption(result.arrangements)
  const count = result.arrangements.length

  const selectOption = (index: number) => {
    setOptionIndex(index)
    tabRefs.current[index]?.focus()
    const next = result.arrangements[index]
    if (next) app.announce(`Option ${next.rank} selected. ${metricText(next)}.`)
  }
  const onTabKeys = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') selectOption((optionIndex + 1) % count)
    else if (event.key === 'ArrowLeft') selectOption((optionIndex - 1 + count) % count)
    else return
    event.preventDefault()
  }
  const tied = (a: Arrangement, i: number) => i > 0 && a.scores.weighted100 === result.arrangements[0]?.scores.weighted100

  return (
    <div className="results-layout">
      <main className="results" aria-labelledby="results-heading">
        <h2 id="results-heading" tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })}>
          Seating plans
        </h2>
        <p>Three best arrangements found. Option 1 scores highest.</p>
        {outOfDate && (
          <div className="banner warn" role="status">
            <strong>Out of date.</strong> These arrangements are for an earlier version of your room, students or rules. Names are as of the last run. Run again to refresh.
          </div>
        )}
        {best && <div className="banner" role="status">{`No option satisfies every rule. Option ${best.rank} breaks the fewest.`}</div>}
        {count < 3 && <div className="banner" role="status">{count === 1 ? 'Only 1 arrangement exists.' : 'Only 2 different arrangements exist.'}</div>}
        <div role="tablist" aria-label="Options" className="option-tabs" onKeyDown={onTabKeys}>
          {result.arrangements.map((a, i) => (
            <button
              key={a.rank}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`option-tab-${i}`}
              aria-selected={i === optionIndex}
              aria-controls="option-panel"
              tabIndex={i === optionIndex ? 0 : -1}
              onClick={() => selectOption(i)}
            >
              <strong>{`Option ${a.rank}`}</strong>
              <span>{metricText(a)}</span>
              <small>{`Score (higher is better): ${formatScore(a.scores.weighted100)}`}</small>
              {tied(a, i) && <small>Tied with Option 1</small>}
            </button>
          ))}
        </div>
        <details className="how-scored">
          <summary>How is the score calculated?</summary>
          <p>Higher is better. Scores are only useful for comparing these options with each other.</p>
        </details>
        <div id="option-panel" role="tabpanel" aria-labelledby={`option-tab-${optionIndex}`}>
          {outOfDate && <p className="stale-label">Out of date</p>}
          <RoomCanvas
            mode="readonly"
            classroom={snapshot}
            deskInfo={deskInfo}
            highlighted={highlighted}
            selectedDeskId={selectedDeskId}
            line={line}
            onSelectDesk={(id) => setSelectedDeskId(id)}
          />
        </div>
        <p className="strip">
          {selectedDesk && selectedStudentId
            ? `${nameOf(selectedStudentId)}: desk row ${selectedDesk.cell.row + 1}, column ${selectedDesk.cell.column + 1}. ${plural(rows.length, 'rule')} involve${rows.length === 1 ? 's' : ''} ${nameOf(selectedStudentId)}.`
            : `${plural(snapshot.desks.length, 'student')} seated in ${plural(snapshot.desks.length, 'desk')}.`}
          {(selectedDeskId || selectedRuleId) && (
            <button
              type="button"
              className="link"
              onClick={() => {
                setSelectedDeskId(null)
                setSelectedRuleId(null)
              }}
            >
              Clear selection
            </button>
          )}
        </p>
      </main>
      <aside className="outcomes" aria-label="Rule outcomes">
        <h2>
          {rows.length === 0 && arrangement.outcomes.length === 0
            ? 'Rules'
            : `Rules: ${counts.map(([g, n]) => `${n} ${OUTCOME_LABEL[g].toLowerCase()}`).join(', ')}`}
        </h2>
        {selectedStudentId && <p>{`Rules involving ${nameOf(selectedStudentId)}`}</p>}
        {arrangement.outcomes.length === 0 && <p className="empty">This plan has no rules to meet.</p>}
        {GROUP_ORDER.map((group) => {
          const groupRows = rows.filter((r) => r.outcome.result === group)
          if (groupRows.length === 0) return null
          return (
            <section key={group} aria-label={OUTCOME_LABEL[group]}>
              <ul className="outcome-list">
                {groupRows.map(({ rule, outcome }) => (
                  <OutcomeRow
                    key={rule.id}
                    rule={rule}
                    outcome={outcome}
                    selected={selectedRuleId === rule.id}
                    nameOf={nameOf}
                    onSelect={() => setSelectedRuleId(selectedRuleId === rule.id ? null : rule.id)}
                    snapshot={snapshot}
                  />
                ))}
              </ul>
            </section>
          )
        })}
        {arrangement.outcomes.some((o) => o.result === 'neutral') && (
          <p className="help">
            Neutral: sits in a row that scores exactly zero, neither near the front nor at the back. This only happens in rooms with an odd number of desk rows (3 or more).
          </p>
        )}
        <HowRulesAreJudged />
      </aside>
    </div>
  )
}

function OutcomeRow(props: {
  rule: Rule
  outcome: Outcome
  selected: boolean
  nameOf: (id: string) => string
  onSelect: () => void
  snapshot: Classroom
}) {
  const { rule, outcome } = props
  return (
    <li className={`outcome outcome-${outcome.result}${props.selected ? ' is-selected' : ''}`}>
      <button type="button" aria-pressed={props.selected} onClick={props.onSelect}>
        <span className="outcome-status">
          <span aria-hidden="true">{OUTCOME_ICON[outcome.result]}</span> {OUTCOME_LABEL[outcome.result]}
        </span>
        <span className="outcome-rule">{ruleSentence(rule, props.nameOf)}</span>
        {props.selected && <span className="outcome-reason">{reasonText(rule, outcome, props.nameOf)}</span>}
      </button>
    </li>
  )
}
