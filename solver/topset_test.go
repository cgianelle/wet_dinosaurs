package solver

import (
	"testing"

	"dsseating/seating"
)

func individual(score int, genes ...int) seating.Individual {
	return seating.Individual{Chromosome: genes, Scores: seating.Scores{Weighted100: score}}
}

func TestTopSetKeepsTheBestDistinctInOrder(t *testing.T) {
	set := newTopSet(3)
	for _, ind := range []seating.Individual{
		individual(5, 0, 1, 2), individual(9, 1, 0, 2), individual(9, 1, 0, 2),
		individual(7, 2, 1, 0), individual(1, 0, 2, 1), individual(8, 2, 0, 1),
	} {
		set.offer(ind)
	}
	var got []int
	for _, m := range set.ranked() {
		got = append(got, m.Scores.Weighted100)
	}
	if want := []int{9, 8, 7}; len(got) != 3 || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Errorf("scores %v, want %v", got, want)
	}
}

func TestTopSetEarlierOfferWinsATie(t *testing.T) {
	set := newTopSet(2)
	set.offer(individual(4, 0, 1))
	set.offer(individual(4, 1, 0))
	set.offer(individual(4, 2, 3))
	if got := set.ranked(); len(got) != 2 || got[0].Chromosome[0] != 0 || got[1].Chromosome[0] != 1 {
		t.Errorf("got %v", got)
	}
}

func TestTopSetCopiesTheChromosomeItKeeps(t *testing.T) {
	set := newTopSet(1)
	genes := []int{0, 1}
	set.offer(individual(1, genes...))
	genes[0] = 99
	if set.ranked()[0].Chromosome[0] != 0 {
		t.Error("topSet kept a reference to the caller's slice")
	}
}
