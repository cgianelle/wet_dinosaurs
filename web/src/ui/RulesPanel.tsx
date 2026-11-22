import { useId, useState, type FormEvent } from 'react'
import { ruleErrors, ruleProblem, ruleStudentIds } from '../model/rules'
import type { Classroom, Rule, RuleType } from '../model/types'
import { useApp } from './AppContext'
import { newId } from './ids'
import { HOW_RULES_ARE_JUDGED, RULE_TYPE_GLOSS, RULE_TYPE_LABELS, nameLookup, ruleProblemMessage, ruleSentence } from './text'

const RULE_TYPES: readonly RuleType[] = ['front', 'notNear', 'isle']

function alphabetical(classroom: Classroom) {
  return [...classroom.students].sort((a, b) => a.name.localeCompare(b.name))
}

export function RuleForm({ classroom, initial, onDone }: { classroom: Classroom; initial?: Rule; onDone?: () => void }) {
  const app = useApp()
  const groupId = useId()
  const [type, setType] = useState<RuleType>(initial?.type ?? 'front')
  const [first, setFirst] = useState(initial ? ruleStudentIds(initial)[0] ?? '' : '')
  const [second, setSecond] = useState(initial?.type === 'notNear' ? initial.studentIds[1] : '')
  const [error, setError] = useState('')
  const students = alphabetical(classroom)
  const notNearAvailable = classroom.students.length >= 2
  const nameOf = nameLookup(classroom)

  const build = (): Rule | null => {
    const id = initial?.id ?? newId()
    if (!first || (type === 'notNear' && !second)) return null
    return type === 'notNear' ? { id, type, studentIds: [first, second] } : { id, type, studentId: first }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const rule = build()
    if (!rule) return setError(type === 'notNear' ? 'Choose two students.' : 'Choose a student.')
    const problem = ruleProblem(classroom, rule, initial?.id)
    if (problem) return setError(ruleProblemMessage(problem, rule, nameOf))
    app.dispatchCommand(initial ? { type: 'editRule', rule } : { type: 'addRule', rule })
    setError('')
    if (!initial) {
      setFirst('')
      setSecond('')
    }
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="rule-form" noValidate>
      <fieldset disabled={app.locked}>
        <legend>{initial ? 'Edit rule' : 'Add a rule'}</legend>
        <div role="radiogroup" aria-label="Rule type" className="segmented">
          {RULE_TYPES.map((candidate) => {
            const unavailable = candidate === 'notNear' && !notNearAvailable
            return (
              <label key={candidate} className={type === candidate ? 'is-checked' : ''}>
                <input
                  type="radio"
                  name={groupId}
                  value={candidate}
                  checked={type === candidate}
                  disabled={unavailable}
                  aria-describedby={`${groupId}-${candidate}`}
                  onChange={() => setType(candidate)}
                />
                {RULE_TYPE_LABELS[candidate]}
                <span id={`${groupId}-${candidate}`} className="gloss">
                  {unavailable ? 'Needs at least 2 students.' : RULE_TYPE_GLOSS[candidate]}
                </span>
              </label>
            )
          })}
        </div>
        <label>
          Student
          <select value={first} onChange={(e) => setFirst(e.target.value)}>
            <option value="">Choose a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {type === 'notNear' && (
          <label>
            Other student
            <select value={second} onChange={(e) => setSecond(e.target.value)}>
              <option value="">Choose a student</option>
              {students
                .filter((s) => s.id !== first)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {error && (
          <p className="problem" role="alert">
            {'⚠ '}
            {error}
          </p>
        )}
        <div className="row">
          <button type="submit" className="primary">
            {initial ? 'Save' : 'Add rule'}
          </button>
          {initial && (
            <button type="button" onClick={onDone}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  )
}

export function HowRulesAreJudged() {
  return (
    <details className="how-judged">
      <summary>How rules are judged</summary>
      {HOW_RULES_ARE_JUDGED.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </details>
  )
}

export function RulesPanel({ classroom }: { classroom: Classroom }) {
  const app = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const nameOf = nameLookup(classroom)
  const broken = new Set(ruleErrors(classroom).map((e) => e.ruleId))
  const matches = (rule: Rule) =>
    ruleSentence(rule, nameOf).toLowerCase().includes(filter.trim().toLowerCase())

  return (
    <section aria-labelledby="rules-heading" className="panel-body">
      <h2 id="rules-heading">
        Rules <span className="count">{classroom.rules.length}</span>
      </h2>
      <RuleForm classroom={classroom} />
      <HowRulesAreJudged />
      {classroom.rules.length > 15 && (
        <label className="filter">
          Filter rules
          <input value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
      )}
      {classroom.rules.length === 0 ? (
        <p className="empty">No rules yet. Rules are optional, but without them the plan is only about fitting everyone in.</p>
      ) : (
        RULE_TYPES.map((type) => {
          const rules = classroom.rules.filter((r) => r.type === type && matches(r))
          if (rules.length === 0) return null
          return (
            <div key={type}>
              <h3>{`${RULE_TYPE_LABELS[type]} (${rules.length})`}</h3>
              <ul className="rule-list">
                {rules.map((rule) =>
                  editing === rule.id ? (
                    <li key={rule.id}>
                      <RuleForm classroom={classroom} initial={rule} onDone={() => setEditing(null)} />
                    </li>
                  ) : (
                    <li key={rule.id}>
                      <span className="name">
                        {broken.has(rule.id) && <span className="problem">{'⚠ This rule names a student who was removed. '}</span>}
                        {ruleSentence(rule, nameOf)}
                      </span>
                      <button type="button" disabled={app.locked} aria-label={`Edit rule: ${ruleSentence(rule, nameOf)}`} onClick={() => setEditing(rule.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={app.locked}
                        aria-label={`Delete rule: ${ruleSentence(rule, nameOf)}`}
                        onClick={() => app.dispatchCommand({ type: 'removeRule', id: rule.id })}
                      >
                        Delete
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )
        })
      )}
    </section>
  )
}
