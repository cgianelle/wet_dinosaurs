package seating

import "math"

// SelectionKind picks how the mating pool is chosen.
type SelectionKind int

// Selection kinds. The zero value is Random, as in the legacy program.
const (
	SelectRandom SelectionKind = iota
	SelectQueen
	SelectPlague
	SelectBeePlague
)

// CrossoverKind picks the crossover operator.
type CrossoverKind int

// Crossover kinds. The zero value is cycle crossover, the default.
const (
	CrossCycle CrossoverKind = iota
	CrossPMX
)

// Config holds the genetic-algorithm parameters.
type Config struct {
	PopSize       int
	Generations   int
	CrossoverRate float64
	MutationRate  float64
	KillRate      int // integer percent removed by plague
	PMXBlock      int
	Selection     SelectionKind
	Crossover     CrossoverKind
}

// DefaultConfig holds the single source of truth for defaults.
func DefaultConfig() Config {
	return Config{
		PopSize:       100,
		Generations:   50,
		CrossoverRate: 0.9,
		MutationRate:  0.1,
		KillRate:      50,
		PMXBlock:      4,
		Selection:     SelectRandom,
		Crossover:     CrossCycle,
	}
}

// Validate reports the first invalid parameter, wrapping ErrInvalidConfig.
func (c Config) Validate() error {
	switch {
	case c.PopSize < 2 || c.PopSize%2 != 0:
		return invalidf("population size %d must be even and at least 2", c.PopSize)
	case c.Generations < 1:
		return invalidf("generations %d must be at least 1", c.Generations)
	case !validRate(c.CrossoverRate):
		return invalidf("crossover rate %v must be in [0,1]", c.CrossoverRate)
	case !validRate(c.MutationRate):
		return invalidf("mutation rate %v must be in [0,1]", c.MutationRate)
	case c.KillRate < 0 || c.KillRate > 99:
		return invalidf("kill rate %d must be in [0,99]", c.KillRate)
	case c.PMXBlock < 1:
		return invalidf("PMX block %d must be at least 1", c.PMXBlock)
	case c.Selection < SelectRandom || c.Selection > SelectBeePlague:
		return invalidf("unknown selection kind %d", c.Selection)
	case c.Crossover < CrossCycle || c.Crossover > CrossPMX:
		return invalidf("unknown crossover kind %d", c.Crossover)
	}
	return nil
}

func validRate(r float64) bool { return !math.IsNaN(r) && r >= 0 && r <= 1 }
