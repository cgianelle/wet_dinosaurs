package solver

import "dsseating/seating"

// nearThreshold is the largest distance, in desk steps, at which two desks are still near (D-2).
const nearThreshold = 2

// outcomeOf judges one rule for a placement. seatOf maps a student index to its seat index
// in the room's canonical order. Definitions are AD-3; the drift-guard test ties the
// thresholds to the engine's scoring.
func (r room) outcomeOf(rule Rule, seatOf []int, studentIndex map[string]int, frontScores []int) Outcome {
	outcome := Outcome{RuleID: rule.ID}
	switch rule.Type {
	case RuleFront:
		seat := r.seats[seatOf[studentIndex[rule.StudentID]]]
		outcome.Result = frontResult(frontScores[seat.Row-1])
		outcome.Detail = Detail{Row: seat.Row, Rows: r.rows}
	case RuleNotNear:
		a := r.seats[seatOf[studentIndex[rule.StudentIDs[0]]]]
		b := r.seats[seatOf[studentIndex[rule.StudentIDs[1]]]]
		distance := stepsBetween(a, b)
		outcome.Result = ResultNotMet
		if distance > nearThreshold {
			outcome.Result = ResultMet
		}
		outcome.Detail = Detail{Distance: distance}
	case RuleIsle:
		seat := r.seats[seatOf[studentIndex[rule.StudentID]]]
		outcome.Result = ResultNotMet
		if seat.Aisle {
			outcome.Result = ResultMet
		}
		outcome.Detail = Detail{Column: seat.Col, Columns: r.columns}
	}
	return outcome
}

func frontResult(rowScore int) string {
	switch {
	case rowScore > 0:
		return ResultMet
	case rowScore == 0:
		return ResultNeutral
	default:
		return ResultNotMet
	}
}

func stepsBetween(a, b seating.Seat) int {
	return abs(a.Row-b.Row) + abs(a.Col-b.Col)
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
