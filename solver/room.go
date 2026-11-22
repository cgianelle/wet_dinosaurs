package solver

import (
	"slices"
	"strings"

	"dsseating/seating"
)

// room is a validated request in canonical order (AD-6) together with the engine view of it
// (AD-2): desks sorted by id, each rebased into front-edge-up engine seats.
type room struct {
	desks    []Desk
	students []Student
	rules    []Rule
	seats    seating.Layout // seats[i] belongs to desks[i]
	rows     int            // R: rebased row count
	columns  int            // C: rebased column span
}

func newRoom(req Request) room {
	r := room{
		desks:    sortedByID(req.Desks, func(d Desk) string { return d.ID }),
		students: sortedByID(req.Students, func(s Student) string { return s.ID }),
		rules:    sortedByID(req.Rules, func(r Rule) string { return r.ID }),
	}
	r.seats, r.rows, r.columns = rebase(r.desks, req.Grid, req.FrontEdge)
	return r
}

func sortedByID[T any](items []T, id func(T) string) []T {
	sorted := slices.Clone(items)
	slices.SortFunc(sorted, func(a, b T) int { return strings.Compare(id(a), id(b)) })
	return sorted
}

// rebase rotates desks so the front edge is up, then shifts them to the desks' bounding box.
// Empty rows and columns outside the desks vanish; gaps between desks stay (AD-2).
func rebase(desks []Desk, grid Grid, edge string) (seats seating.Layout, rows, columns int) {
	depths := make([]int, len(desks))
	laterals := make([]int, len(desks))
	for i, desk := range desks {
		depths[i], laterals[i] = rotateToFront(desk, grid, edge)
	}
	minDepth, maxDepth := slices.Min(depths), slices.Max(depths)
	minLateral, maxLateral := slices.Min(laterals), slices.Max(laterals)
	rows, columns = maxDepth-minDepth+1, maxLateral-minLateral+1
	seats = make(seating.Layout, len(desks))
	for i := range desks {
		col := laterals[i] - minLateral + 1
		seats[i] = seating.Seat{
			Row:   depths[i] - minDepth + 1,
			Col:   col,
			Aisle: col == 1 || col == columns,
		}
	}
	return seats, rows, columns
}

// rotateToFront returns the desk's distance from the front edge and its position along it.
func rotateToFront(desk Desk, grid Grid, edge string) (depth, lateral int) {
	switch edge {
	case EdgeBottom:
		return grid.Rows - 1 - desk.Row, desk.Column
	case EdgeLeft:
		return desk.Column, desk.Row
	case EdgeRight:
		return grid.Columns - 1 - desk.Column, desk.Row
	default:
		return desk.Row, desk.Column
	}
}

func (r room) studentIndex() map[string]int {
	index := make(map[string]int, len(r.students))
	for i, student := range r.students {
		index[student.ID] = i
	}
	return index
}

// engineRules expresses the canonical rules with person indices; legacy proximity (D5).
func (r room) engineRules() seating.Rules {
	index := r.studentIndex()
	var rules seating.Rules
	for _, rule := range r.rules {
		switch rule.Type {
		case RuleFront:
			rules.FrontRow = append(rules.FrontRow, index[rule.StudentID])
		case RuleIsle:
			rules.Aisle = append(rules.Aisle, index[rule.StudentID])
		case RuleNotNear:
			rules.NotNear = append(rules.NotNear, seating.Pair{A: index[rule.StudentIDs[0]], B: index[rule.StudentIDs[1]]})
		}
	}
	return rules
}

func (r room) people() []seating.Person {
	people := make([]seating.Person, len(r.students))
	for i := range people {
		people[i] = seating.Person{Label: decimal(i)}
	}
	return people
}
