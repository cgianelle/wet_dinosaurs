// Package seating is a pure genetic-algorithm engine that seats people in a layout.
package seating

import (
	"errors"
	"fmt"
)

// ErrInvalidConfig is wrapped by every error caused by invalid caller input.
var ErrInvalidConfig = errors.New("invalid configuration")

func invalidf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidConfig, fmt.Sprintf(format, args...))
}

// Seat is one position; Row and Col are 1-based and row 1 is the front.
type Seat struct {
	Row, Col int
	Aisle    bool
}

// Layout lists the seats; a chromosome index is an index into the layout.
type Layout []Seat

// Grid builds a row-major rows x cols layout whose first and last columns are aisle seats.
func Grid(rows, cols int) Layout {
	layout := make(Layout, 0, rows*cols)
	for row := 1; row <= rows; row++ {
		for col := 1; col <= cols; col++ {
			layout = append(layout, Seat{Row: row, Col: col, Aisle: col == 1 || col == cols})
		}
	}
	return layout
}

// Person is one entry of the people list.
type Person struct{ Label string }

const (
	defaultRows   = 5
	defaultCols   = 4
	defaultPeople = defaultRows * defaultCols
)

// DefaultLayout is the legacy 5x4 classroom.
func DefaultLayout() Layout { return Grid(defaultRows, defaultCols) }

// DefaultPeople is the legacy people list A-T.
func DefaultPeople() []Person {
	people := make([]Person, defaultPeople)
	for i := range people {
		people[i] = Person{Label: string(rune('A' + i))}
	}
	return people
}

// DefaultFrontRowScores is the legacy per-row front-row score, indexed by Row-1.
func DefaultFrontRowScores() []int { return []int{10, 7, 0, -7, -10} }
