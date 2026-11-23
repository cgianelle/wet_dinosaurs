package solver

import (
	"context"
	"errors"
	"fmt"
	"math/rand/v2"

	"dsseating/seating"
)

const arrangementsReturned = 3

// Options are test hooks; none is on the wire.
type Options struct {
	// Seed overrides the seed derived from the input (AD-6).
	Seed *uint64
}

// generationsPerStudent scales the run with the room. Measured on a 50-desk irregular room
// (build step 3): 50 generations averaged 92 percent of the best score that 1000 generations
// of 400 reached, 500 generations of 100 reached 96 percent, and a run still took about 35 ms.
const generationsPerStudent = 10

// RunBudget is the single place that tunes the GA for a request of n students (AD-8).
// Rooms of five or fewer students keep the engine default; larger rooms get ten generations per student.
func RunBudget(students int) seating.Config {
	config := seating.DefaultConfig()
	config.Generations = max(config.Generations, generationsPerStudent*students)
	return config
}

// Solve validates the request, runs the engine and returns up to three ranked arrangements.
// A cancelled or expired context stops the run between generations and returns the context error.
func Solve(ctx context.Context, req Request, opts Options) (Response, error) {
	if err := Validate(req); err != nil {
		return Response{}, err
	}
	r := newRoom(req)
	problem, err := seating.NewProblem(r.seats, r.people(), r.frontTable, r.engineRules())
	if err != nil {
		return Response{}, fmt.Errorf("solver: engine rejected a validated request: %w", err)
	}
	seed := seedOf(req.Grid, req.FrontEdge, r)
	if opts.Seed != nil {
		seed = *opts.Seed
	}
	best := newTopSet(arrangementsReturned)
	observe := func(pop seating.Population) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		for _, individual := range pop.Individuals {
			best.offer(individual)
		}
		return nil
	}
	rng := rand.New(rand.NewPCG(seed, webStream))
	if _, err := seating.Run(problem, RunBudget(len(r.students)), rng, observe); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return Response{}, err
		}
		return Response{}, fmt.Errorf("solver: engine run failed: %w", err)
	}
	return r.respond(req, best.ranked()), nil
}

func (r room) respond(req Request, ranked []seating.Individual) Response {
	studentIndex := r.studentIndex()
	response := Response{Arrangements: make([]Arrangement, len(ranked))}
	for i, individual := range ranked {
		seatOf := inverse(individual.Chromosome)
		outcomes := make([]Outcome, len(req.Rules))
		met := 0
		for j, rule := range req.Rules {
			outcomes[j] = r.outcomeOf(rule, seatOf, studentIndex)
			if outcomes[j].Result == ResultMet {
				met++
			}
		}
		response.Arrangements[i] = Arrangement{
			Rank:        i + 1,
			Scores:      scoresOf(individual.Scores),
			RulesMet:    met,
			RulesTotal:  len(outcomes),
			Assignments: r.assignments(individual.Chromosome),
			Outcomes:    outcomes,
		}
	}
	return response
}

func (r room) assignments(chromosome seating.Chromosome) []Assignment {
	assignments := make([]Assignment, len(chromosome))
	for seat, person := range chromosome {
		assignments[seat] = Assignment{StudentID: r.students[person].ID, DeskID: r.desks[seat].ID}
	}
	return assignments
}

func inverse(chromosome seating.Chromosome) []int {
	seatOf := make([]int, len(chromosome))
	for seat, person := range chromosome {
		seatOf[person] = seat
	}
	return seatOf
}

func scoresOf(s seating.Scores) Scores {
	return Scores{Front: s.Front, NearBy: s.NearBy, Isle: s.Aisle, Total: s.Total, Weighted100: s.Weighted100}
}

func decimal(i int) string { return fmt.Sprintf("%d", i) }
