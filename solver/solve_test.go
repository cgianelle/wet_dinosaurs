package solver

import (
	"context"
	"errors"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"

	"dsseating/seating"
)

// randomRoom builds a valid request with desks scattered on a random grid, a front edge
// and a mix of rules, so rotation, gaps and all rule types are exercised.
func randomRoom(rng *rand.Rand, edge string) Request {
	columns, rows := 1+rng.IntN(MaxColumns), 1+rng.IntN(MaxRows)
	cells := rng.Perm(columns * rows)
	n := 1 + rng.IntN(min(MaxDesks, columns*rows, 14))
	req := Request{Grid: Grid{columns, rows}, FrontEdge: edge}
	for i := 0; i < n; i++ {
		req.Desks = append(req.Desks, Desk{ID: decimalID("d", i), Column: cells[i] % columns, Row: cells[i] / columns})
		req.Students = append(req.Students, Student{ID: decimalID("s", i)})
	}
	req.Rules = randomRules(rng, n)
	return req
}

func randomRules(rng *rand.Rand, n int) []Rule {
	rules := []Rule{}
	frontOf, isleOf, pairs := map[int]bool{}, map[int]bool{}, map[[2]int]bool{}
	for i := 0; i < n+2; i++ {
		id := decimalID("r", len(rules))
		a, b := rng.IntN(n), rng.IntN(n)
		switch rng.IntN(3) {
		case 0:
			if !frontOf[a] {
				frontOf[a] = true
				rules = append(rules, Rule{ID: id, Type: RuleFront, StudentID: decimalID("s", a)})
			}
		case 1:
			if !isleOf[a] {
				isleOf[a] = true
				rules = append(rules, Rule{ID: id, Type: RuleIsle, StudentID: decimalID("s", a)})
			}
		default:
			key := [2]int{min(a, b), max(a, b)}
			if a != b && !pairs[key] {
				pairs[key] = true
				rules = append(rules, Rule{ID: id, Type: RuleNotNear, StudentIDs: []string{decimalID("s", a), decimalID("s", b)}})
			}
		}
	}
	return rules
}

func solve(t *testing.T, req Request) Response {
	t.Helper()
	resp, err := Solve(context.Background(), req, Options{})
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestSolveAgreesWithIndependentRecomputationOnAllFrontEdges(t *testing.T) {
	rng := rand.New(rand.NewPCG(7, 11))
	for _, edge := range []string{EdgeTop, EdgeBottom, EdgeLeft, EdgeRight} {
		for trial := 0; trial < 12; trial++ {
			req := randomRoom(rng, edge)
			assertArrangementsAgreeWithOracle(t, req, solve(t, req))
		}
	}
}

func TestSolveIsDeterministicAndIgnoresListOrder(t *testing.T) {
	req := randomRoom(rand.New(rand.NewPCG(3, 5)), EdgeLeft)
	first := solve(t, req)
	if !reflect.DeepEqual(first, solve(t, req)) {
		t.Fatal("same request gave different responses")
	}
	shuffled := req
	shuffled.Desks = slices.Clone(req.Desks)
	shuffled.Students = slices.Clone(req.Students)
	slices.Reverse(shuffled.Desks)
	slices.Reverse(shuffled.Students)
	again := solve(t, shuffled)
	if !reflect.DeepEqual(first.Arrangements, again.Arrangements) {
		t.Fatal("list order changed the arrangements")
	}
}

func TestSolveSeedOverrideChangesTheStream(t *testing.T) {
	req := randomRoom(rand.New(rand.NewPCG(9, 9)), EdgeTop)
	one, two := uint64(1), uint64(2)
	a, _ := Solve(context.Background(), req, Options{Seed: &one})
	b, _ := Solve(context.Background(), req, Options{Seed: &two})
	if reflect.DeepEqual(a, b) {
		t.Skip("two seeds happened to agree")
	}
}

func TestSolveReturnsFewerThanThreeWhenFewerExist(t *testing.T) {
	cases := map[int]int{1: 1, 2: 2, 3: 3}
	for n, want := range cases {
		req := Request{Grid: Grid{3, 1}, FrontEdge: EdgeTop}
		for i := 0; i < n; i++ {
			req.Desks = append(req.Desks, Desk{ID: decimalID("d", i), Column: i})
			req.Students = append(req.Students, Student{ID: decimalID("s", i)})
		}
		req.Rules = []Rule{}
		if got := len(solve(t, req).Arrangements); got != want {
			t.Errorf("%d students: %d arrangements, want %d", n, got, want)
		}
	}
}

func TestSolveWithZeroRulesIsValid(t *testing.T) {
	req := randomRoom(rand.New(rand.NewPCG(1, 2)), EdgeTop)
	req.Rules = []Rule{}
	resp := solve(t, req)
	if resp.Arrangements[0].RulesTotal != 0 || resp.Arrangements[0].Scores.Weighted100 != 0 {
		t.Errorf("%+v", resp.Arrangements[0])
	}
}

func TestSolveRefusesInvalidRequestsWithATypedError(t *testing.T) {
	req := validRequest()
	req.FrontEdge = "up"
	_, err := Solve(context.Background(), req, Options{})
	var refusal *Error
	if !errors.As(err, &refusal) || refusal.Code != CodeInvalidFrontEdge {
		t.Errorf("got %v", err)
	}
}

func TestSolveStopsWhenTheContextIsCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := Solve(ctx, validRequest(), Options{})
	if !errors.Is(err, context.Canceled) {
		t.Errorf("got %v, want context.Canceled", err)
	}
}

// Regression (FR-27): a 5x4 room with the front on top scores exactly as the engine does
// for the legacy layout.
func TestFacadeScoresMatchTheEngineOnTheLegacyRoom(t *testing.T) {
	req := Request{Grid: Grid{Columns: 4, Rows: 5}, FrontEdge: EdgeTop, Rules: []Rule{
		{ID: "r1", Type: RuleFront, StudentID: "s0"},
		{ID: "r2", Type: RuleNotNear, StudentIDs: []string{"s1", "s2"}},
		{ID: "r3", Type: RuleIsle, StudentID: "s3"},
	}}
	for i := 0; i < 20; i++ {
		req.Desks = append(req.Desks, Desk{ID: decimalID("d", 100+i), Column: i % 4, Row: i / 4})
		req.Students = append(req.Students, Student{ID: decimalID("s", i)})
	}
	r := newRoom(req)
	facade, err := seating.NewProblem(r.seats, r.people(), FrontScores(r.rows), r.engineRules())
	if err != nil {
		t.Fatal(err)
	}
	// Engine rules for the same people, expressed against the legacy layout.
	legacy, err := seating.NewProblem(seating.DefaultLayout(), seating.DefaultPeople(), seating.DefaultFrontRowScores(), r.engineRules())
	if err != nil {
		t.Fatal(err)
	}
	rng := rand.New(rand.NewPCG(4, 4))
	for i := 0; i < 50; i++ {
		c := seating.Chromosome(rng.Perm(20))
		if facade.Evaluate(c).Scores != legacy.Evaluate(c).Scores {
			t.Fatalf("scores differ for %v", c)
		}
	}
}

// Drift guard (AD-3): the verdicts the facade reports for every seat and seat pair agree with
// the sign of the score the engine gives a one-rule problem.
func TestOutcomesAgreeWithEngineScoringForOneRuleProblems(t *testing.T) {
	rng := rand.New(rand.NewPCG(21, 22))
	for _, edge := range []string{EdgeTop, EdgeRight} {
		req := randomRoom(rng, edge)
		for len(req.Desks) < 3 {
			req = randomRoom(rng, edge)
		}
		r := newRoom(req)
		front := FrontScores(r.rows)
		index := r.studentIndex()
		n := len(r.seats)
		people := r.people()
		for a := 0; a < n; a++ {
			assertVerdictMatchesEngine(t, r, front, index, people, a, (a+1)%n)
		}
	}
}

func assertVerdictMatchesEngine(t *testing.T, r room, front []int, index map[string]int, people []seating.Person, a, b int) {
	t.Helper()
	chromosome := make(seating.Chromosome, len(r.seats))
	for seat := range chromosome {
		chromosome[seat] = seat
	}
	chromosome[a], chromosome[b] = 1, 0 // student 0 sits at seat b, student 1 at seat a
	seatOf := inverse(chromosome)
	rule := func(typ string) Rule {
		switch typ {
		case RuleNotNear:
			return Rule{ID: "x", Type: typ, StudentIDs: []string{r.students[0].ID, r.students[1].ID}}
		}
		return Rule{ID: "x", Type: typ, StudentID: r.students[0].ID}
	}
	engine := func(rules seating.Rules) seating.Scores {
		p, err := seating.NewProblem(r.seats, people, front, rules)
		if err != nil {
			t.Fatal(err)
		}
		return p.Evaluate(chromosome).Scores
	}
	frontScore := engine(seating.Rules{FrontRow: []int{0}}).Front
	if got := r.outcomeOf(rule(RuleFront), seatOf, index, front).Result; got != frontResult(frontScore) {
		t.Errorf("front: facade %s, engine score %d", got, frontScore)
	}
	nearScore := engine(seating.Rules{NotNear: []seating.Pair{{A: 0, B: 1}}}).NearBy
	if got := r.outcomeOf(rule(RuleNotNear), seatOf, index, front).Result; (got == ResultMet) != (nearScore > 0) {
		t.Errorf("not near: facade %s, engine score %d", got, nearScore)
	}
	aisleScore := engine(seating.Rules{Aisle: []int{0}}).Aisle
	if got := r.outcomeOf(rule(RuleIsle), seatOf, index, front).Result; (got == ResultMet) != (aisleScore > 0) {
		t.Errorf("isle: facade %s, engine score %d", got, aisleScore)
	}
}
