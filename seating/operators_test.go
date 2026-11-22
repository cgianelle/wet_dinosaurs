package seating

import (
	"errors"
	"math/rand/v2"
	"slices"
	"testing"
)

func newRNG(seed uint64) *rand.Rand { return rand.New(rand.NewPCG(seed, 0x9E3779B97F4A7C15)) }

func randomChromosome(n int, rng *rand.Rand) Chromosome { return Chromosome(rng.Perm(n)) }

const propertyRuns = 1500

func TestPMXChildrenAreValidAndLeaveParentsUntouched(t *testing.T) {
	rng := newRNG(1)
	for run := 0; run < propertyRuns; run++ {
		n := 2 + rng.IntN(25)
		a, b := randomChromosome(n, rng), randomChromosome(n, rng)
		aCopy, bCopy := slices.Clone(a), slices.Clone(b)
		x, y := pmx(a, b, rng, 4)
		if !IsPermutation(x, n) || !IsPermutation(y, n) {
			t.Fatalf("invalid PMX children %v %v from %v %v", x, y, a, b)
		}
		if !slices.Equal(a, aCopy) || !slices.Equal(b, bCopy) {
			t.Fatal("parents were modified")
		}
	}
}

func TestPMXBlockComesFromTheOtherParent(t *testing.T) {
	a := Chromosome{0, 1, 2, 3, 4, 5, 6, 7}
	b := Chromosome{7, 6, 5, 4, 3, 2, 1, 0}
	child := pmxChild(a, b, 2, 6)
	if !slices.Equal(child[2:6], b[2:6]) || !IsPermutation(child, 8) {
		t.Errorf("child %v", child)
	}
}

func TestCycleCrossoverChildrenAreValidAndGenesComeFromAParent(t *testing.T) {
	rng := newRNG(2)
	for run := 0; run < propertyRuns; run++ {
		n := 2 + rng.IntN(25)
		a, b := randomChromosome(n, rng), randomChromosome(n, rng)
		x, y := cycleCrossover(a, b, rng)
		if !IsPermutation(x, n) || !IsPermutation(y, n) {
			t.Fatalf("invalid CX children %v %v", x, y)
		}
		for i := range x {
			if x[i] != a[i] && x[i] != b[i] || y[i] != a[i] && y[i] != b[i] {
				t.Fatalf("gene at %d not from a parent", i)
			}
		}
	}
}

func TestCycleCrossoverStartVariesAcrossPairs(t *testing.T) {
	a := Chromosome{0, 1, 2, 3, 4, 5}
	b := Chromosome{1, 0, 3, 2, 5, 4} // three 2-cycles; the child depends on the start
	rng := newRNG(3)
	seen := map[string]bool{}
	for run := 0; run < 200; run++ {
		x, _ := cycleCrossover(a, b, rng)
		seen[string(rune(x[0]))+string(rune(x[2]))+string(rune(x[4]))] = true
	}
	if len(seen) < 2 {
		t.Errorf("cycle start never varied: %v", seen)
	}
}

func TestMutateRateZeroNeverChangesAndRateOneAlwaysDoes(t *testing.T) {
	rng := newRNG(4)
	for run := 0; run < propertyRuns; run++ {
		n := 2 + rng.IntN(25)
		c := randomChromosome(n, rng)
		original := slices.Clone(c)
		if got := mutate(c, 0, rng); !slices.Equal(got, original) {
			t.Fatal("rate 0 changed the chromosome")
		}
		got := mutate(c, 1, rng)
		if slices.Equal(got, original) || !IsPermutation(got, n) {
			t.Fatalf("rate 1: %v from %v", got, original)
		}
		if !slices.Equal(c, original) {
			t.Fatal("mutation modified its input")
		}
	}
}

func TestMutateReversesAContiguousRange(t *testing.T) {
	c := Chromosome{0, 1, 2, 3, 4, 5, 6, 7}
	got := mutate(c, 1, newRNG(5))
	first, last := -1, -1
	for i := range c {
		if got[i] != c[i] {
			if first < 0 {
				first = i
			}
			last = i
		}
	}
	reversed := slices.Clone(c)
	slices.Reverse(reversed[first : last+1])
	if !slices.Equal(got, reversed) {
		t.Errorf("not an inversion: %v", got)
	}
}

func populationWithScores(scores ...int) []Individual {
	inds := make([]Individual, len(scores))
	for i, s := range scores {
		inds[i] = Individual{Chromosome: Chromosome{i}, Scores: Scores{Weighted100: s}}
	}
	return inds
}

func idsOf(pool []Individual) []int {
	ids := make([]int, len(pool))
	for i, ind := range pool {
		ids[i] = ind.Chromosome[0]
	}
	return ids
}

func TestEverySelectionReturnsAPoolOfPopSize(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7, 3, 8, 2, 6, 4, 0)
	for _, kind := range []SelectionKind{SelectRandom, SelectQueen, SelectPlague, SelectBeePlague} {
		c := DefaultConfig()
		c.Selection, c.PopSize = kind, len(pop)
		pool := selectPool(c, pop, newRNG(6))
		if len(pool) != len(pop) {
			t.Errorf("kind %d: pool %d", kind, len(pool))
		}
	}
}

func TestRandomSelectionDrawsWithReplacement(t *testing.T) {
	pop := populationWithScores(1, 2, 3)
	c := DefaultConfig()
	c.PopSize = 200
	pool := selectPool(c, pop, newRNG(7))
	seen := map[int]bool{}
	for _, id := range idsOf(pool) {
		seen[id] = true
	}
	if len(pool) != 200 || len(seen) != 3 {
		t.Errorf("pool %d, distinct %d", len(pool), len(seen))
	}
}

func TestQueenSelectionPairsTheBestWithOthers(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7)
	c := DefaultConfig()
	c.Selection, c.PopSize = SelectQueen, 100
	pool := selectPool(c, pop, newRNG(8))
	for i := 0; i < len(pool); i += 2 {
		if pool[i].Chromosome[0] != 1 {
			t.Fatalf("slot %d is not the queen", i)
		}
		if pool[i+1].Chromosome[0] == 1 {
			t.Fatalf("slot %d repeats the queen", i+1)
		}
	}
}

func TestQueenSelectionWithSingleMemberUsesTheQueen(t *testing.T) {
	c := DefaultConfig()
	c.Selection, c.PopSize = SelectQueen, 4
	pool := selectPool(c, populationWithScores(3), newRNG(9))
	if !slices.Equal(idsOf(pool), []int{0, 0, 0, 0}) {
		t.Errorf("got %v", idsOf(pool))
	}
}

func TestPlagueRemovesTheWeakestAndAllowsTheLastSurvivor(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7, 3, 8, 2, 6, 4, 0)
	c := DefaultConfig()
	c.Selection, c.PopSize, c.KillRate = SelectPlague, 10, 50
	survivors := map[int]bool{1: true, 3: true, 5: true, 7: true, 0: true} // scores 9,7,8,6,5
	seen := map[int]bool{}
	for seed := uint64(0); seed < 50; seed++ {
		for _, id := range idsOf(selectPool(c, pop, newRNG(seed))) {
			if !survivors[id] {
				t.Fatalf("killed individual %d was selected", id)
			}
			seen[id] = true
		}
	}
	if len(seen) != 5 {
		t.Errorf("not every survivor selectable: %v", seen)
	}
}

func TestPlagueKillRateZeroKeepsEveryoneAndNinetyNineKeepsOne(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7)
	c := DefaultConfig()
	c.Selection, c.PopSize = SelectPlague, 400
	c.KillRate = 0
	seen := map[int]bool{}
	for _, id := range idsOf(selectPool(c, pop, newRNG(10))) {
		seen[id] = true
	}
	if len(seen) != 4 {
		t.Errorf("kill 0 should keep all, saw %v", seen)
	}
	hundred := populationWithScores(make([]int, 100)...)
	for i := range hundred {
		hundred[i].Scores.Weighted100 = i
	}
	c.KillRate, c.PopSize = 99, 100
	for _, id := range idsOf(selectPool(c, hundred, newRNG(11))) {
		if id != 99 {
			t.Fatalf("only the best should survive, got %d", id)
		}
	}
}

func TestPlagueTiesRemoveHigherIndexFirst(t *testing.T) {
	pop := populationWithScores(5, 5, 5, 5)
	c := DefaultConfig()
	c.Selection, c.PopSize, c.KillRate = SelectPlague, 200, 50
	for _, id := range idsOf(selectPool(c, pop, newRNG(12))) {
		if id > 1 {
			t.Fatalf("individual %d should have been killed", id)
		}
	}
}

func TestBeePlagueAppliesQueenToSurvivors(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7, 3, 8, 2, 6, 4, 0)
	c := DefaultConfig()
	c.Selection, c.PopSize, c.KillRate = SelectBeePlague, 10, 50
	survivors := map[int]bool{1: true, 3: true, 5: true, 7: true, 0: true}
	pool := selectPool(c, pop, newRNG(13))
	for i, id := range idsOf(pool) {
		if !survivors[id] {
			t.Fatalf("killed individual %d selected", id)
		}
		if i%2 == 0 && id != 1 {
			t.Fatalf("slot %d should be the queen", i)
		}
	}
}

func TestBeePlagueWithOneSurvivorRepeatsIt(t *testing.T) {
	pop := populationWithScores(5, 9, 1, 7)
	c := DefaultConfig()
	c.Selection, c.PopSize, c.KillRate = SelectBeePlague, 6, 99
	if got := idsOf(selectPool(c, pop, newRNG(14))); !slices.Equal(got, []int{1, 1, 1, 1, 1, 1}) {
		t.Errorf("got %v", got)
	}
}

func runProblem(t *testing.T) Problem {
	t.Helper()
	return problemWith(t, Rules{
		FrontRow: []int{0, 3, 5},
		NotNear:  []Pair{{16, 17}, {16, 18}, {17, 18}},
		Aisle:    []int{5},
	})
}

func TestRunObservesInitialThenEveryGenerationInOrder(t *testing.T) {
	var generations []int
	final, err := Run(runProblem(t), DefaultConfig(), newRNG(15), func(pop Population) error {
		generations = append(generations, pop.Generation)
		if len(pop.Individuals) != 100 {
			t.Errorf("population of %d", len(pop.Individuals))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(generations) != 51 || generations[0] != -1 || generations[1] != 0 || generations[50] != 49 {
		t.Errorf("generations %v", generations)
	}
	if final.Generation != 49 {
		t.Errorf("final generation %d", final.Generation)
	}
}

func TestRunProducesOnlyPermutationsForEveryOperatorCombination(t *testing.T) {
	problem := runProblem(t)
	for _, sel := range []SelectionKind{SelectRandom, SelectQueen, SelectPlague, SelectBeePlague} {
		for _, cross := range []CrossoverKind{CrossCycle, CrossPMX} {
			c := DefaultConfig()
			c.Selection, c.Crossover, c.MutationRate, c.CrossoverRate = sel, cross, 0.5, 1
			for seed := uint64(0); seed < 20; seed++ {
				_, err := Run(problem, c, newRNG(seed), func(pop Population) error {
					for _, ind := range pop.Individuals {
						if !IsPermutation(ind.Chromosome, 20) {
							t.Fatalf("invalid chromosome %v", ind.Chromosome)
						}
					}
					return nil
				})
				if err != nil {
					t.Fatal(err)
				}
			}
		}
	}
}

func TestRunIsDeterministicForASeed(t *testing.T) {
	problem := runProblem(t)
	collect := func() [][]Individual {
		var all [][]Individual
		_, err := Run(problem, DefaultConfig(), newRNG(99), func(pop Population) error {
			all = append(all, pop.Individuals)
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
		return all
	}
	a, b := collect(), collect()
	for g := range a {
		for i := range a[g] {
			if !slices.Equal(a[g][i].Chromosome, b[g][i].Chromosome) {
				t.Fatalf("generation index %d individual %d differs", g, i)
			}
		}
	}
}

func TestRunBestIsFirstMaximum(t *testing.T) {
	_, err := Run(runProblem(t), DefaultConfig(), newRNG(16), func(pop Population) error {
		best := pop.Individuals[pop.Best].Scores.Weighted100
		for i, ind := range pop.Individuals {
			if ind.Scores.Weighted100 > best || (ind.Scores.Weighted100 == best && i < pop.Best) {
				t.Fatalf("best index %d is not the first maximum", pop.Best)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestRunStopsWhenObserverFails(t *testing.T) {
	boom := errors.New("boom")
	calls := 0
	_, err := Run(runProblem(t), DefaultConfig(), newRNG(17), func(Population) error {
		calls++
		if calls == 3 {
			return boom
		}
		return nil
	})
	if !errors.Is(err, boom) || calls != 3 {
		t.Errorf("err %v after %d calls", err, calls)
	}
}

func TestRunRejectsInvalidConfigAndNilRNG(t *testing.T) {
	c := DefaultConfig()
	c.PopSize = 3
	if _, err := Run(runProblem(t), c, newRNG(1), nil); !errors.Is(err, ErrInvalidConfig) {
		t.Errorf("config: %v", err)
	}
	if _, err := Run(runProblem(t), DefaultConfig(), nil, nil); !errors.Is(err, ErrInvalidConfig) {
		t.Errorf("nil rng: %v", err)
	}
}

func TestRunOnNonDefaultLayoutWorks(t *testing.T) {
	people := make([]Person, 6)
	for i := range people {
		people[i] = Person{Label: string(rune('a' + i))}
	}
	p, err := NewProblem(Grid(2, 3), people, []int{5, -5}, Rules{FrontRow: []int{0}})
	if err != nil {
		t.Fatal(err)
	}
	c := DefaultConfig()
	c.PopSize, c.Generations = 10, 5
	final, err := Run(p, c, newRNG(18), nil)
	if err != nil || final.Individuals[final.Best].Scores.Front != 5 {
		t.Errorf("final best %+v err %v", final.Individuals[final.Best].Scores, err)
	}
}
