package solver

import (
	"math"
	"slices"
	"testing"
)

// The oracle recomputes scores and outcomes from raw room coordinates without using
// rebase, rotateToFront or FrontScores: it physically turns a matrix of desk ids until the
// front edge is on top, then reads rows and columns off the matrix (AD-7).

type placedStudent struct{ row, column int } // 1-based, front-up, bounding box of the desks

type oracleView struct {
	at      map[string]placedStudent // by student id
	rows    int
	columns int
}

func oracleViewOf(req Request, assignments []Assignment) oracleView {
	matrix := make([][]string, req.Grid.Rows)
	for r := range matrix {
		matrix[r] = make([]string, req.Grid.Columns)
	}
	for _, desk := range req.Desks {
		matrix[desk.Row][desk.Column] = desk.ID
	}
	for turns := quarterTurnsToFront(req.FrontEdge); turns > 0; turns-- {
		matrix = turnClockwise(matrix)
	}
	deskAt := map[string]placedStudent{}
	minRow, maxRow, minCol, maxCol := math.MaxInt, -1, math.MaxInt, -1
	for r, line := range matrix {
		for c, id := range line {
			if id == "" {
				continue
			}
			deskAt[id] = placedStudent{r, c}
			minRow, maxRow = min(minRow, r), max(maxRow, r)
			minCol, maxCol = min(minCol, c), max(maxCol, c)
		}
	}
	view := oracleView{at: map[string]placedStudent{}, rows: maxRow - minRow + 1, columns: maxCol - minCol + 1}
	for _, a := range assignments {
		p := deskAt[a.DeskID]
		view.at[a.StudentID] = placedStudent{row: p.row - minRow + 1, column: p.column - minCol + 1}
	}
	return view
}

func quarterTurnsToFront(edge string) int {
	return map[string]int{EdgeTop: 0, EdgeLeft: 1, EdgeBottom: 2, EdgeRight: 3}[edge]
}

func turnClockwise(m [][]string) [][]string {
	rows, cols := len(m), len(m[0])
	turned := make([][]string, cols)
	for c := range turned {
		turned[c] = make([]string, rows)
		for r := 0; r < rows; r++ {
			turned[c][rows-1-r] = m[r][c]
		}
	}
	return turned
}

func oracleFrontTable(rows int) []int {
	anchors := []float64{10, 7, 0, -7, -10}
	table := make([]int, rows)
	for k := range table {
		if rows == 1 {
			table[k] = 10
			continue
		}
		position := 4 * float64(k) / float64(rows-1)
		low := int(math.Floor(position))
		if low >= 4 {
			table[k] = -10
			continue
		}
		table[k] = int(anchors[low]) + int(math.Round((anchors[low+1]-anchors[low])*(position-float64(low))))
	}
	return table
}

func abs2(v int) int { return int(math.Abs(float64(v))) }

// oracleJudge returns the expected scores and outcomes for one arrangement.
func oracleJudge(req Request, assignments []Assignment) (Scores, []Outcome) {
	view := oracleViewOf(req, assignments)
	table := oracleFrontTable(view.rows)
	var scores Scores
	outcomes := make([]Outcome, len(req.Rules))
	for i, rule := range req.Rules {
		outcome := Outcome{RuleID: rule.ID}
		switch rule.Type {
		case RuleFront:
			p := view.at[rule.StudentID]
			scores.Front += table[p.row-1]
			switch score := table[p.row-1]; {
			case score > 0:
				outcome.Result = ResultMet
			case score == 0:
				outcome.Result = ResultNeutral
			default:
				outcome.Result = ResultNotMet
			}
			outcome.Detail = Detail{Row: p.row, Rows: view.rows}
		case RuleNotNear:
			a, b := view.at[rule.StudentIDs[0]], view.at[rule.StudentIDs[1]]
			d := abs2(a.row-b.row) + abs2(a.column-b.column)
			if d > 2 {
				scores.NearBy += 5 * d
				outcome.Result = ResultMet
			} else {
				scores.NearBy -= 5 * d
				outcome.Result = ResultNotMet
			}
			outcome.Detail = Detail{Distance: d}
		case RuleIsle:
			p := view.at[rule.StudentID]
			if p.column == 1 || p.column == view.columns {
				scores.Isle += 10
				outcome.Result = ResultMet
			} else {
				scores.Isle -= 10
				outcome.Result = ResultNotMet
			}
			outcome.Detail = Detail{Column: p.column, Columns: view.columns}
		}
		outcomes[i] = outcome
	}
	f, n, s := scores.Front, scores.NearBy, scores.Isle
	scores.Total = f + n + s
	scores.Weighted100 = 60*(f+n) + 10*(f+s) + 10*(n+s) + 4*f + 4*n + 2*s
	return scores, outcomes
}

// assertArrangementsAgreeWithOracle checks every property of a response that does not
// depend on the random stream.
func assertArrangementsAgreeWithOracle(t *testing.T, req Request, resp Response) {
	t.Helper()
	if n := len(resp.Arrangements); n < 1 || n > 3 {
		t.Fatalf("got %d arrangements", n)
	}
	var seen [][]Assignment
	for i, a := range resp.Arrangements {
		if a.Rank != i+1 {
			t.Errorf("arrangement %d has rank %d", i, a.Rank)
		}
		if i > 0 && a.Scores.Weighted100 > resp.Arrangements[i-1].Scores.Weighted100 {
			t.Errorf("arrangement %d outranks its predecessor", i)
		}
		assertPermutation(t, req, a)
		wantScores, wantOutcomes := oracleJudge(req, a.Assignments)
		if a.Scores != wantScores {
			t.Errorf("arrangement %d scores %+v, oracle %+v", i, a.Scores, wantScores)
		}
		if !slices.Equal(unmirrored(a.Outcomes), unmirrored(wantOutcomes)) {
			t.Errorf("arrangement %d outcomes %+v, oracle %+v", i, a.Outcomes, wantOutcomes)
		}
		met := 0
		for _, o := range wantOutcomes {
			if o.Result == ResultMet {
				met++
			}
		}
		if a.RulesMet != met || a.RulesTotal != len(req.Rules) {
			t.Errorf("arrangement %d tally %d of %d, want %d of %d", i, a.RulesMet, a.RulesTotal, met, len(req.Rules))
		}
		for _, other := range seen {
			if slices.Equal(other, a.Assignments) {
				t.Errorf("arrangement %d repeats an earlier assignment", i)
			}
		}
		seen = append(seen, a.Assignments)
	}
}

func assertPermutation(t *testing.T, req Request, a Arrangement) {
	t.Helper()
	if len(a.Assignments) != len(req.Desks) {
		t.Fatalf("%d assignments for %d desks", len(a.Assignments), len(req.Desks))
	}
	students, desks := map[string]bool{}, map[string]bool{}
	for i, as := range a.Assignments {
		students[as.StudentID], desks[as.DeskID] = true, true
		if i > 0 && a.Assignments[i-1].DeskID >= as.DeskID {
			t.Errorf("assignments not ordered by deskId at %d", i)
		}
	}
	if len(students) != len(req.Students) || len(desks) != len(req.Desks) {
		t.Errorf("assignments are not a one-to-one seating")
	}
}

// unmirrored folds an isle column onto its mirror image: the oracle turns the room physically
// while the facade counts along the front edge as drawn, and the two may differ by a reflection.
func unmirrored(outcomes []Outcome) []Outcome {
	folded := slices.Clone(outcomes)
	for i, o := range folded {
		if o.Detail.Columns > 0 {
			folded[i].Detail.Column = min(o.Detail.Column, o.Detail.Columns+1-o.Detail.Column)
		}
	}
	return folded
}
