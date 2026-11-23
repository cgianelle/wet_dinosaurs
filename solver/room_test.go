package solver

import (
	"reflect"
	"testing"

	"dsseating/seating"
)

func seatAt(row, col int, aisle bool) seating.Seat {
	return seating.Seat{Row: row, Col: col, Aisle: aisle}
}

func TestRebaseRotatesTheFrontWallUpAndKeepsGaps(t *testing.T) {
	grid := Grid{Columns: 4, Rows: 3}
	desks := []Desk{{"a", 1, 1}, {"b", 2, 1}, {"c", 1, 2}}
	cases := []struct {
		edge          string
		want          []seating.Seat
		rows, columns int
	}{
		{EdgeTop, []seating.Seat{seatAt(1, 1, true), seatAt(1, 2, true), seatAt(2, 1, true)}, 2, 2},
		{EdgeBottom, []seating.Seat{seatAt(2, 1, true), seatAt(2, 2, true), seatAt(1, 1, true)}, 2, 2},
		{EdgeLeft, []seating.Seat{seatAt(1, 1, true), seatAt(2, 1, true), seatAt(1, 2, true)}, 2, 2},
		{EdgeRight, []seating.Seat{seatAt(2, 1, true), seatAt(1, 1, true), seatAt(2, 2, true)}, 2, 2},
	}
	for _, c := range cases {
		f := rebase(desks, grid, c.edge)
		if !reflect.DeepEqual([]seating.Seat(f.seats), c.want) || f.rows != c.rows || f.columns != c.columns {
			t.Errorf("%s: seats=%v rows=%d columns=%d, want %v %d %d", c.edge, f.seats, f.rows, f.columns, c.want, c.rows, c.columns)
		}
	}
}

func TestRebaseDiscardsEmptyOuterLinesButKeepsInnerGaps(t *testing.T) {
	desks := []Desk{{"a", 2, 3}, {"b", 6, 3}, {"c", 4, 5}}
	f := rebase(desks, Grid{Columns: 10, Rows: 10}, EdgeTop)
	want := []seating.Seat{seatAt(1, 1, true), seatAt(1, 5, true), seatAt(3, 3, false)}
	if !reflect.DeepEqual([]seating.Seat(f.seats), want) {
		t.Errorf("seats=%v, want %v", f.seats, want)
	}
}

// Empty interior rows and columns keep their physical distance but are not counted (D-1, D-3).
func TestRebaseRanksOnlyOccupiedRowsAndColumnsOnEveryFrontWall(t *testing.T) {
	// Screen rows 0, 3 and 5 hold desks; screen columns 1, 2 and 6 hold desks.
	desks := []Desk{{"a", 1, 0}, {"b", 6, 3}, {"c", 2, 5}}
	cases := []struct {
		edge     string
		rowOf    []int
		columnOf []int
	}{
		{EdgeTop, []int{1, 2, 3}, []int{1, 3, 2}},
		{EdgeBottom, []int{3, 2, 1}, []int{1, 3, 2}},
		{EdgeLeft, []int{1, 3, 2}, []int{1, 2, 3}},
		{EdgeRight, []int{3, 1, 2}, []int{1, 2, 3}},
	}
	for _, c := range cases {
		f := rebase(desks, Grid{Columns: 8, Rows: 6}, c.edge)
		if !reflect.DeepEqual(f.rowOf, c.rowOf) || !reflect.DeepEqual(f.columnOf, c.columnOf) || f.rows != 3 || f.columns != 3 {
			t.Errorf("%s: rowOf=%v columnOf=%v rows=%d columns=%d", c.edge, f.rowOf, f.columnOf, f.rows, f.columns)
		}
		curve := FrontScores(3)
		for i, seat := range f.seats {
			if f.frontTable[seat.Row-1] != curve[f.rowOf[i]-1] {
				t.Errorf("%s: desk %d scores %d, want %d", c.edge, i, f.frontTable[seat.Row-1], curve[f.rowOf[i]-1])
			}
		}
	}
}

func TestAisleFlagMarksLeftmostAndRightmostOccupiedColumns(t *testing.T) {
	desks := []Desk{{"a", 0, 0}, {"b", 1, 0}, {"c", 2, 0}}
	f := rebase(desks, Grid{Columns: 3, Rows: 1}, EdgeTop)
	if f.columns != 3 || !f.seats[0].Aisle || f.seats[1].Aisle || !f.seats[2].Aisle {
		t.Errorf("seats=%v columns=%d", f.seats, f.columns)
	}
}

func TestOneColumnRoomIsAlwaysAisle(t *testing.T) {
	f := rebase([]Desk{{"a", 0, 0}, {"b", 0, 1}}, Grid{Columns: 1, Rows: 2}, EdgeTop)
	if !f.seats[0].Aisle || !f.seats[1].Aisle {
		t.Errorf("seats=%v", f.seats)
	}
}
