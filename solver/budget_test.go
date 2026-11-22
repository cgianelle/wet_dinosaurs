package solver

import (
	"testing"

	"dsseating/seating"
)

func TestRunBudgetKeepsDefaultsForTinyRoomsAndScalesLargerOnes(t *testing.T) {
	defaults := seating.DefaultConfig()
	if got := RunBudget(5); got != defaults {
		t.Errorf("RunBudget(5) = %+v, want defaults", got)
	}
	previous := 0
	for n := 1; n <= MaxStudents; n++ {
		config := RunBudget(n)
		if err := config.Validate(); err != nil {
			t.Fatalf("RunBudget(%d): %v", n, err)
		}
		if config.Generations < previous {
			t.Errorf("RunBudget(%d) has fewer generations than RunBudget(%d)", n, n-1)
		}
		previous = config.Generations
	}
	if got := RunBudget(MaxStudents).Generations; got != 500 {
		t.Errorf("RunBudget(50).Generations = %d, want 500", got)
	}
}
