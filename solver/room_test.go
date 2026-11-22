package solver

import (
	"reflect"
	"testing"

	"dsseating/seating"
)

func seatAt(row, col int, aisle bool) seating.Seat {
	return seating.Seat{Row: row, Col: col, Aisle: aisle}
}

func TestRebaseRotatesTheFrontEdgeUpAndKeepsGaps(t *testing.T) {
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
		seats, rows, columns := rebase(desks, grid, c.edge)
		if !reflect.DeepEqual([]seating.Seat(seats), c.want) || rows != c.rows || columns != c.columns {
			t.Errorf("%s: seats=%v rows=%d columns=%d, want %v %d %d", c.edge, seats, rows, columns, c.want, c.rows, c.columns)
		}
	}
}

func TestRebaseDiscardsEmptyOuterLinesButKeepsInnerGaps(t *testing.T) {
	desks := []Desk{{"a", 2, 3}, {"b", 6, 3}, {"c", 4, 5}}
	seats, rows, columns := rebase(desks, Grid{Columns: 10, Rows: 10}, EdgeTop)
	want := []seating.Seat{seatAt(1, 1, true), seatAt(1, 5, true), seatAt(3, 3, false)}
	if !reflect.DeepEqual([]seating.Seat(seats), want) || rows != 3 || columns != 5 {
		t.Errorf("seats=%v rows=%d columns=%d, want %v 3 5", seats, rows, columns, want)
	}
}

func TestAisleFlagMarksLeftmostAndRightmostOccupiedColumns(t *testing.T) {
	desks := []Desk{{"a", 0, 0}, {"b", 1, 0}, {"c", 2, 0}}
	seats, _, columns := rebase(desks, Grid{Columns: 3, Rows: 1}, EdgeTop)
	if columns != 3 || !seats[0].Aisle || seats[1].Aisle || !seats[2].Aisle {
		t.Errorf("seats=%v columns=%d", seats, columns)
	}
}

func TestOneColumnRoomIsAlwaysAisle(t *testing.T) {
	seats, _, _ := rebase([]Desk{{"a", 0, 0}, {"b", 0, 1}}, Grid{Columns: 1, Rows: 2}, EdgeTop)
	if !seats[0].Aisle || !seats[1].Aisle {
		t.Errorf("seats=%v", seats)
	}
}
