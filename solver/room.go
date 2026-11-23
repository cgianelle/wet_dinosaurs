package solver

import (
	"slices"
	"strings"

	"dsseating/seating"
)

// room is a validated request in canonical order (AD-6) together with the engine view of it
// (AD-2): desks sorted by id, each rebased into front-wall-up engine seats.
type room struct {
	desks    []Desk
	students []Student
	rules    []Rule
	frame
}

// frame is the engine view of the desks. seats[i], rowOf[i] and columnOf[i] belong to desks[i].
// rowOf and columnOf are 1-based dense ranks among occupied lines, counted from the front wall
// (AD-3); rows and columns are the numbers of occupied lines. frontTable is the engine's
// per-physical-row score table, which scores only occupied rows (AD-2 step 4).
type frame struct {
	seats      seating.Layout
	rowOf      []int
	columnOf   []int
	rows       int
	columns    int
	frontTable []int
}

func newRoom(req Request) room {
	r := room{
		desks:    sortedByID(req.Desks, func(d Desk) string { return d.ID }),
		students: sortedByID(req.Students, func(s Student) string { return s.ID }),
		rules:    sortedByID(req.Rules, func(r Rule) string { return r.ID }),
	}
	r.frame = rebase(r.desks, req.Grid, req.FrontEdge)
	return r
}

func sortedByID[T any](items []T, id func(T) string) []T {
	sorted := slices.Clone(items)
	slices.SortFunc(sorted, func(a, b T) int { return strings.Compare(id(a), id(b)) })
	return sorted
}

// rebase rotates desks so the front wall is up, then shifts them to the desks' bounding box.
// Empty rows and columns outside the desks vanish; gaps between desks stay as physical
// distance (AD-2). Rows and columns are then ranked densely so empty lines are not counted.
func rebase(desks []Desk, grid Grid, edge string) frame {
	depths := make([]int, len(desks))
	laterals := make([]int, len(desks))
	for i, desk := range desks {
		depths[i], laterals[i] = rotateToFront(desk, grid, edge)
	}
	minDepth, minLateral := slices.Min(depths), slices.Min(laterals)
	occupiedDepths, occupiedLaterals := distinctSorted(depths), distinctSorted(laterals)
	maxCol := slices.Max(laterals) - minLateral + 1
	f := frame{
		seats:    make(seating.Layout, len(desks)),
		rowOf:    make([]int, len(desks)),
		columnOf: make([]int, len(desks)),
		rows:     len(occupiedDepths),
		columns:  len(occupiedLaterals),
	}
	for i := range desks {
		col := laterals[i] - minLateral + 1
		f.seats[i] = seating.Seat{Row: depths[i] - minDepth + 1, Col: col, Aisle: col == 1 || col == maxCol}
		f.rowOf[i] = rankOf(occupiedDepths, depths[i])
		f.columnOf[i] = rankOf(occupiedLaterals, laterals[i])
	}
	f.frontTable = frontTableFor(f.seats, f.rowOf, f.rows)
	return f
}

func distinctSorted(values []int) []int {
	sorted := slices.Clone(values)
	slices.Sort(sorted)
	return slices.Compact(sorted)
}

// rankOf is the 1-based position of value among the sorted distinct values.
func rankOf(sortedValues []int, value int) int {
	position, _ := slices.BinarySearch(sortedValues, value)
	return position + 1
}

// frontTableFor builds the engine's table, one entry per physical row: the stretched curve
// over the occupied rows, and 0 for rows without a desk, which no seat ever indexes.
func frontTableFor(seats seating.Layout, rowOf []int, occupiedRows int) []int {
	maxRow := 0
	for _, seat := range seats {
		maxRow = max(maxRow, seat.Row)
	}
	curve := FrontScores(occupiedRows)
	table := make([]int, maxRow)
	for i, seat := range seats {
		table[seat.Row-1] = curve[rowOf[i]-1]
	}
	return table
}

// rotateToFront returns the desk's distance from the front wall and its position along it.
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
