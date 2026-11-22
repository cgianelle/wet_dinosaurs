package solver

import (
	"slices"
	"testing"

	"dsseating/seating"
)

func TestFrontScoresMatchHandComputedExamples(t *testing.T) {
	cases := map[int][]int{
		1: {10},
		2: {10, -10},
		3: {10, 0, -10},
		4: {10, 5, -5, -10},
	}
	for rows, want := range cases {
		if got := FrontScores(rows); !slices.Equal(got, want) {
			t.Errorf("FrontScores(%d) = %v, want %v", rows, got, want)
		}
	}
}

func TestFrontScoresForFiveRowsAreTheLegacyTable(t *testing.T) {
	if got, want := FrontScores(5), seating.DefaultFrontRowScores(); !slices.Equal(got, want) {
		t.Errorf("FrontScores(5) = %v, want legacy %v", got, want)
	}
}

func TestFrontScoresAreMonotonicWithFixedEnds(t *testing.T) {
	for rows := 1; rows <= MaxRows; rows++ {
		scores := FrontScores(rows)
		if len(scores) != rows || scores[0] != 10 {
			t.Fatalf("rows=%d: %v", rows, scores)
		}
		if rows >= 2 && scores[rows-1] != -10 {
			t.Errorf("rows=%d: last entry %d, want -10", rows, scores[rows-1])
		}
		if !slices.IsSortedFunc(scores, func(a, b int) int { return b - a }) {
			t.Errorf("rows=%d: not non-increasing: %v", rows, scores)
		}
	}
}

func TestFrontScoresHaveANeutralRowOnlyForOddRowCountsOfThreeOrMore(t *testing.T) {
	for rows := 1; rows <= MaxRows; rows++ {
		hasZero := slices.Contains(FrontScores(rows), 0)
		if want := rows >= 3 && rows%2 == 1; hasZero != want {
			t.Errorf("rows=%d: has a zero row = %v, want %v (%v)", rows, hasZero, want, FrontScores(rows))
		}
	}
}
