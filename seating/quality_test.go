//go:build quality

package seating

import (
	"slices"
	"testing"
)

// Run with: go test -tags quality -run Quality -v ./seating
// Thresholds live here and nowhere else; the check reports PASS/FAIL plus the measured fraction.
const (
	qualityRuns             = 30
	qualityMinCleanFraction = 0.90
	// The paper's converged values were produced with greedy selections, not random selection.
	paperGreedyMedianBest = 96.92 // informational only
	paperGreedyMaxBest    = 99.14 // informational only
)

type qualityOutcome struct {
	cleanFraction float64
	finalBests    []float64 // sorted; best weighted score of each run's last generation
	bestsEver     []float64 // sorted; best weighted score seen in any generation of each run
}

func (o qualityOutcome) medianFinal() float64    { return median(o.finalBests) }
func (o qualityOutcome) medianBestEver() float64 { return median(o.bestsEver) }

func strictProblem(t *testing.T) (Problem, Rules) {
	t.Helper()
	index := func(label string) int { return int(label[0] - 'A') }
	rules := Rules{
		FrontRow:        []int{index("A"), index("D"), index("F"), index("I"), index("L"), index("P"), index("R")},
		NotNear:         []Pair{{index("Q"), index("R")}, {index("Q"), index("S")}, {index("R"), index("S")}},
		Aisle:           []int{index("F")},
		StrictProximity: true,
	}
	problem, err := NewProblem(DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), rules)
	if err != nil {
		t.Fatal(err)
	}
	return problem, rules
}

func measureQuality(t *testing.T, problem Problem, rules Rules, config Config) qualityOutcome {
	t.Helper()
	clean := 0
	var outcome qualityOutcome
	for seed := uint64(1); seed <= qualityRuns; seed++ {
		bestEver := 0.0
		track := func(pop Population) error {
			bestEver = max(bestEver, pop.Individuals[pop.Best].Scores.Weighted())
			return nil
		}
		final, err := Run(problem, config, newRNG(seed), track)
		if err != nil {
			t.Fatal(err)
		}
		best := final.Individuals[final.Best]
		outcome.finalBests = append(outcome.finalBests, best.Scores.Weighted())
		outcome.bestsEver = append(outcome.bestsEver, bestEver)
		if noClosePair(problem, best.Chromosome, rules.NotNear) {
			clean++
		}
	}
	slices.Sort(outcome.finalBests)
	slices.Sort(outcome.bestsEver)
	outcome.cleanFraction = float64(clean) / qualityRuns
	return outcome
}

func median(sorted []float64) float64 {
	n := len(sorted)
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

func greedyConfig() Config {
	config := DefaultConfig()
	config.Selection = SelectBeePlague
	config.KillRate = 50
	return config
}

func TestQualityStrictModeKeepsQRSApart(t *testing.T) {
	problem, rules := strictProblem(t)
	runs := []struct {
		label  string
		config Config
	}{
		{"random-selection baseline (DefaultConfig, no selection pressure)", DefaultConfig()},
		{"greedy selection (BeePlague 50, cycle crossover)", greedyConfig()},
	}
	for _, run := range runs {
		t.Run(run.label, func(t *testing.T) {
			outcome := measureQuality(t, problem, rules, run.config)
			t.Logf("informational: median final-generation best %.2f, median best-ever %.2f (paper greedy-selection converged median %.2f, max %.2f)",
				outcome.medianFinal(), outcome.medianBestEver(), paperGreedyMedianBest, paperGreedyMaxBest)
			if outcome.cleanFraction < qualityMinCleanFraction {
				t.Errorf("FAIL: clean fraction %.2f below %.2f", outcome.cleanFraction, qualityMinCleanFraction)
			} else {
				t.Logf("PASS: clean fraction %.2f (threshold %.2f)", outcome.cleanFraction, qualityMinCleanFraction)
			}
		})
	}
}

func noClosePair(p Problem, c Chromosome, pairs []Pair) bool {
	seatOf := inverse(c)
	for _, pair := range pairs {
		if halfUnitDistance(p.layout[seatOf[pair.A]], p.layout[seatOf[pair.B]]) <= farThresholdInHalf {
			return false
		}
	}
	return true
}
