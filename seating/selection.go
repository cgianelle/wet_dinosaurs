package seating

import (
	"math/rand/v2"
	"sort"
)

// selectPool returns a mating pool of exactly c.PopSize individuals in pairing order.
func selectPool(c Config, pop []Individual, rng *rand.Rand) []Individual {
	switch c.Selection {
	case SelectQueen:
		return queenPool(pop, c.PopSize, rng)
	case SelectPlague:
		return randomPool(plagueSurvivors(pop, c.KillRate), c.PopSize, rng)
	case SelectBeePlague:
		return queenPool(plagueSurvivors(pop, c.KillRate), c.PopSize, rng)
	default:
		return randomPool(pop, c.PopSize, rng)
	}
}

func randomPool(pop []Individual, size int, rng *rand.Rand) []Individual {
	pool := make([]Individual, size)
	for i := range pool {
		pool[i] = pop[rng.IntN(len(pop))]
	}
	return pool
}

// queenPool alternates the best individual with others drawn (with replacement) from the rest.
func queenPool(pop []Individual, size int, rng *rand.Rand) []Individual {
	queen := bestIndex(pop)
	pool := make([]Individual, 0, size)
	for len(pool) < size {
		other := queen
		if len(pop) > 1 {
			other = rng.IntN(len(pop) - 1)
			if other >= queen {
				other++
			}
		}
		pool = append(pool, pop[queen], pop[other])
	}
	return pool
}

// plagueSurvivors removes the weakest PopSize*killRate/100 individuals (ties: higher index first).
func plagueSurvivors(pop []Individual, killRate int) []Individual {
	kill := len(pop) * killRate / 100
	order := make([]int, len(pop))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(x, y int) bool {
		a, b := pop[order[x]].Scores.Weighted100, pop[order[y]].Scores.Weighted100
		if a != b {
			return a < b
		}
		return order[x] > order[y]
	})
	removed := make(map[int]bool, kill)
	for _, index := range order[:kill] {
		removed[index] = true
	}
	survivors := make([]Individual, 0, len(pop)-kill)
	for i, ind := range pop {
		if !removed[i] {
			survivors = append(survivors, ind)
		}
	}
	return survivors
}

// bestIndex is the first index holding the maximum Weighted100.
func bestIndex(pop []Individual) int {
	best := 0
	for i := range pop {
		if pop[i].Scores.Weighted100 > pop[best].Scores.Weighted100 {
			best = i
		}
	}
	return best
}
