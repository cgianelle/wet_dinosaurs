package seating

import (
	"fmt"
	"math/rand/v2"
)

// InitialGeneration is the Generation index of the random starting population.
const InitialGeneration = -1

// Population is exactly PopSize scored individuals; Best indexes the best one.
type Population struct {
	Generation  int
	Individuals []Individual
	Best        int
}

func newPopulation(generation int, individuals []Individual) Population {
	return Population{Generation: generation, Individuals: individuals, Best: bestIndex(individuals)}
}

// Run evolves a population: generation -1 is random, then Generations bred generations
// (select, cross adjacent pairs, mutate, score). observe receives every population in order.
func Run(p Problem, c Config, rng *rand.Rand, observe func(Population) error) (Population, error) {
	if err := c.Validate(); err != nil {
		return Population{}, err
	}
	if rng == nil {
		return Population{}, invalidf("random generator is required")
	}
	current := p.initialPopulation(c.PopSize, rng)
	if err := deliver(current, p.Size(), c.PopSize, observe); err != nil {
		return Population{}, err
	}
	for generation := 0; generation < c.Generations; generation++ {
		pool := selectPool(c, current.Individuals, rng)
		current = newPopulation(generation, p.breed(c, pool, rng))
		if err := deliver(current, p.Size(), c.PopSize, observe); err != nil {
			return Population{}, err
		}
	}
	return current, nil
}

func (p Problem) initialPopulation(size int, rng *rand.Rand) Population {
	individuals := make([]Individual, size)
	for i := range individuals {
		individuals[i] = p.Evaluate(Chromosome(rng.Perm(p.Size())))
	}
	return newPopulation(InitialGeneration, individuals)
}

func (p Problem) breed(c Config, pool []Individual, rng *rand.Rand) []Individual {
	children := make([]Chromosome, 0, len(pool))
	for i := 0; i+1 < len(pool); i += 2 {
		x, y := cross(c, pool[i].Chromosome, pool[i+1].Chromosome, rng)
		children = append(children, x, y)
	}
	offspring := make([]Individual, len(children))
	for i, child := range children {
		offspring[i] = p.Evaluate(mutate(child, c.MutationRate, rng))
	}
	return offspring
}

// cross passes copies of the parents through when the crossover rate does not fire.
func cross(c Config, a, b Chromosome, rng *rand.Rand) (Chromosome, Chromosome) {
	if !(rng.Float64() < c.CrossoverRate) {
		return append(Chromosome(nil), a...), append(Chromosome(nil), b...)
	}
	if c.Crossover == CrossPMX {
		return pmx(a, b, rng, c.PMXBlock)
	}
	return cycleCrossover(a, b, rng)
}

func deliver(pop Population, seats, popSize int, observe func(Population) error) error {
	if err := verify(pop, seats, popSize); err != nil {
		return err
	}
	if observe == nil {
		return nil
	}
	return observe(pop)
}

func verify(pop Population, seats, popSize int) error {
	if len(pop.Individuals) != popSize {
		return fmt.Errorf("seating: generation %d has %d individuals, want %d", pop.Generation, len(pop.Individuals), popSize)
	}
	for i, ind := range pop.Individuals {
		if !IsPermutation(ind.Chromosome, seats) {
			return fmt.Errorf("seating: generation %d individual %d is not a permutation", pop.Generation, i)
		}
	}
	return nil
}
