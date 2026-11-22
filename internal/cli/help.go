package cli

import (
	"fmt"
	"strconv"
	"strings"

	"dsseating/seating"
)

const helpTemplate = `dsseating - seat {COUNT} students ({RANGE}) in a {ROWS}x{COLS} classroom with a genetic algorithm

USAGE
  dsseating [rules] [options]
  dsseating -h

RULES  (repeat -frontrow, -proximity and -isle to add more rules)
  -frontrow X         Student X wants a front-row seat.
                      Score by row: {FRONTROWS}
  -proximity X Y      Students X and Y should NOT sit near each other.
  -isle X             Student X must sit on an outside aisle seat
                      (first or last column). +10 if so, else -10.
  -strictprox         Harsher -proximity scoring: any pair that is too close
                      (distance <= 1) costs a flat -30. Without it, the legacy
                      scoring is used (the closer, the bigger the penalty).
  List each student once per switch and each pair once (Q R and R Q are the
  same pair). A student may appear under different switches.

SELECTION  (choose at most one; default: -random)
  -random             Pick {POP} parents at random, with replacement (default).
  -queen              Queen bee: the best individual of the current generation
                      mates with {HALF} random others.
  -plague             Remove the weakest -killrate percent, then pick parents
                      from the survivors.
  -beeplague          Plague first, then queen bee on the survivors.
  -killrate N         Percent removed by -plague / -beeplague, 0-99 (default {KILL}).

CROSSOVER  (choose at most one; default: -cx)
  -cx                 Cycle crossover (default). Starting point varies per pair.
  -pmx                Partially mapped crossover, block size {BLOCK}.
  -xoverrate R        Chance a pair is crossed, 0.0-1.0 (default {XOVER}).

MUTATION
  -mutrate R          Chance each individual is mutated (inversion), 0.0-1.0
                      (default {MUT}).

RUN
  -seed N             Make the run repeatable. Same seed + same options give
                      identical output. Default: taken from the clock. The seed
                      used is always printed.
  -out DIR            Directory for the reports (default ./{OUT}, created if
                      missing).
  -h, -help, --help   Show this help.
  Every option except -frontrow, -proximity and -isle may be given only once.

STUDENTS  are the letters {RANGE}. Lowercase is accepted. To keep three students
  apart, list each pair:  -proximity Q R -proximity Q S -proximity R S

OUTPUT
  Writes {FILES} files to the output directory: Generation5050.txt (the starting
  population) and Generation0.txt .. Generation{LAST}.txt. Each starts with the
  best individual. Scores may be negative. Existing files with those names are
  overwritten.

EXIT STATUS
  0 success (also -h)   1 could not write output   2 bad command line

EXAMPLE
  dsseating -frontrow A -frontrow D -proximity Q R -isle F -plague -pmx \
            -xoverrate 0.85 -mutrate 0.05 -killrate 75 -seed 42
`

// Help renders the help text from the same defaults the parser uses.
func Help() string {
	cfg := seating.DefaultConfig()
	people := seating.DefaultPeople()
	layout := seating.DefaultLayout()
	last := layout[len(layout)-1]
	return strings.NewReplacer(
		"{COUNT}", strconv.Itoa(len(people)),
		"{RANGE}", people[0].Label+"-"+people[len(people)-1].Label,
		"{ROWS}", strconv.Itoa(last.Row),
		"{COLS}", strconv.Itoa(last.Col),
		"{FRONTROWS}", frontRowSummary(seating.DefaultFrontRowScores()),
		"{POP}", strconv.Itoa(cfg.PopSize),
		"{HALF}", strconv.Itoa(cfg.PopSize/2),
		"{KILL}", strconv.Itoa(cfg.KillRate),
		"{BLOCK}", strconv.Itoa(cfg.PMXBlock),
		"{XOVER}", formatRate(cfg.CrossoverRate),
		"{MUT}", formatRate(cfg.MutationRate),
		"{OUT}", defaultOutDir,
		"{FILES}", strconv.Itoa(cfg.Generations+1),
		"{LAST}", strconv.Itoa(cfg.Generations-1),
	).Replace(helpTemplate)
}

func frontRowSummary(scores []int) string {
	parts := make([]string, len(scores))
	for i, score := range scores {
		sign := ""
		if score > 0 {
			sign = "+"
		}
		parts[i] = fmt.Sprintf("%d:%s%d", i+1, sign, score)
	}
	return strings.Join(parts, "  ")
}

func formatRate(rate float64) string { return strconv.FormatFloat(rate, 'f', -1, 64) }
