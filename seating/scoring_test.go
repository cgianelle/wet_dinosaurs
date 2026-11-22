package seating

import (
	"errors"
	"testing"
)

// place builds a chromosome with the given persons at the given seats and the rest filled in order.
func place(n int, at map[int]int) Chromosome {
	c := make(Chromosome, n)
	taken := make(map[int]bool)
	for i := range c {
		c[i] = -1
	}
	for person, seat := range at {
		c[seat] = person
		taken[person] = true
	}
	next := 0
	for seat := range c {
		if c[seat] != -1 {
			continue
		}
		for taken[next] {
			next++
		}
		c[seat] = next
		taken[next] = true
	}
	return c
}

func problemWith(t *testing.T, rules Rules) Problem {
	t.Helper()
	p, err := NewProblem(DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), rules)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestFrontRowScoreByRow(t *testing.T) {
	// seats 0,4,8,12,16 are column 1 of rows 1..5
	want := []int{10, 7, 0, -7, -10}
	for row, expected := range want {
		p := problemWith(t, Rules{FrontRow: []int{0}})
		got := p.Evaluate(place(20, map[int]int{0: row * 4})).Scores.Front
		if got != expected {
			t.Errorf("row %d: got %d, want %d", row+1, got, expected)
		}
	}
}

func TestAisleScoreFirstAndLastColumn(t *testing.T) {
	p := problemWith(t, Rules{Aisle: []int{0}})
	cases := map[int]int{0: 10, 1: -10, 2: -10, 3: 10}
	for seat, want := range cases {
		if got := p.Evaluate(place(20, map[int]int{0: seat})).Scores.Aisle; got != want {
			t.Errorf("seat %d: got %d, want %d", seat, got, want)
		}
	}
}

func TestNearByDefaultAndStrictModes(t *testing.T) {
	cases := []struct {
		name          string
		seatA, seatB  int
		wantDefault   int
		wantStrictMod int
	}{
		{"adjacent h=1", 0, 1, -5, -30},
		{"two apart h=2 d=1", 0, 2, -10, -30},
		{"diagonal h=2 d=1", 0, 5, -10, -30},
		{"h=3 d=1.5", 0, 3, 15, 15},
		{"far corners h=7", 0, 19, 35, 35},
		{"row 5 pair (legacy bug) h=3", 16, 19, 15, 15},
		{"same row end to end h=3 in row 5", 19, 16, 15, 15},
	}
	for _, tc := range cases {
		pair := Pair{A: 0, B: 1}
		layout := place(20, map[int]int{0: tc.seatA, 1: tc.seatB})
		def := problemWith(t, Rules{NotNear: []Pair{pair}})
		strict := problemWith(t, Rules{NotNear: []Pair{pair}, StrictProximity: true})
		if got := def.Evaluate(layout).Scores.NearBy; got != tc.wantDefault {
			t.Errorf("%s default: got %d, want %d", tc.name, got, tc.wantDefault)
		}
		if got := strict.Evaluate(layout).Scores.NearBy; got != tc.wantStrictMod {
			t.Errorf("%s strict: got %d, want %d", tc.name, got, tc.wantStrictMod)
		}
	}
}

func TestNearByUsesRealCoordinatesAfterRepeatedEvaluations(t *testing.T) {
	p := problemWith(t, Rules{NotNear: []Pair{{A: 0, B: 1}}})
	near := p.Evaluate(place(20, map[int]int{0: 0, 1: 1}))
	far := p.Evaluate(place(20, map[int]int{0: 0, 1: 19}))
	nearAgain := p.Evaluate(place(20, map[int]int{0: 0, 1: 1}))
	if near.Scores.NearBy != nearAgain.Scores.NearBy || far.Scores.NearBy != 35 {
		t.Errorf("stale state: near %d, far %d, nearAgain %d", near.Scores.NearBy, far.Scores.NearBy, nearAgain.Scores.NearBy)
	}
}

func TestTotalAndWeightedHandComputed(t *testing.T) {
	p := problemWith(t, Rules{FrontRow: []int{0}})
	s := p.Evaluate(place(20, map[int]int{0: 0})).Scores
	if s.Total != 10 || s.Weighted100 != 740 || s.Weighted() != 7.4 {
		t.Errorf("got %+v", s)
	}
}

func TestWeightedHasNoFloorAtZero(t *testing.T) {
	p := problemWith(t, Rules{
		FrontRow: []int{0},
		NotNear:  []Pair{{A: 1, B: 2}},
		Aisle:    []int{3},
	})
	// person 0 row 5 (-10); persons 1,2 adjacent (-5); person 3 not aisle (-10)
	s := p.Evaluate(place(20, map[int]int{0: 16, 1: 5, 2: 6, 3: 9})).Scores
	if s.Front != -10 || s.NearBy != -5 || s.Aisle != -10 || s.Total != -25 {
		t.Fatalf("components: %+v", s)
	}
	// 0.6*(-15) + 0.1*(-20) + 0.1*(-15) + 0.04*-10 + 0.04*-5 + 0.02*-10 = -9-2-1.5-0.4-0.2-0.2 = -13.3
	if s.Weighted100 != -1330 {
		t.Errorf("Weighted100 = %d, want -1330", s.Weighted100)
	}
}

func TestNonDefaultLayout(t *testing.T) {
	layout := Grid(3, 5)
	people := make([]Person, 15)
	for i := range people {
		people[i] = Person{Label: string(rune('a' + i))}
	}
	rules := Rules{FrontRow: []int{0, 1}, NotNear: []Pair{{A: 2, B: 3}}, Aisle: []int{4, 5}}
	p, err := NewProblem(layout, people, []int{5, 0, -5}, rules)
	if err != nil {
		t.Fatal(err)
	}
	// person0 row1 (+5); person1 row3 (seat 10 -> -5); persons 2,3 at seats 0 and 14: h=2+4=6 -> +30
	// person4 at seat 4 (col 5 aisle +10); person5 at seat 7 (col 3, -10)
	c := place(15, map[int]int{0: 1, 1: 10, 2: 0, 3: 14, 4: 4, 5: 7})
	s := p.Evaluate(c).Scores
	if s.Front != 0 || s.NearBy != 30 || s.Aisle != 0 {
		t.Errorf("got %+v", s)
	}
}

func TestNewProblemRejectsInvalidInput(t *testing.T) {
	cases := map[string]struct {
		layout Layout
		people []Person
		table  []int
		rules  Rules
	}{
		"people count":    {DefaultLayout(), DefaultPeople()[:19], DefaultFrontRowScores(), Rules{}},
		"table length":    {DefaultLayout(), DefaultPeople(), []int{1, 2}, Rules{}},
		"empty layout":    {Layout{}, nil, nil, Rules{}},
		"dup front row":   {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{FrontRow: []int{1, 1}}},
		"dup aisle":       {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{Aisle: []int{2, 2}}},
		"dup pair":        {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{NotNear: []Pair{{1, 2}, {2, 1}}}},
		"self pair":       {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{NotNear: []Pair{{3, 3}}}},
		"index range":     {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{Aisle: []int{20}}},
		"pair range":      {DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(), Rules{NotNear: []Pair{{0, -1}}}},
		"duplicate label": {Grid(1, 2), []Person{{"A"}, {"A"}}, []int{0}, Rules{}},
	}
	for name, tc := range cases {
		_, err := NewProblem(tc.layout, tc.people, tc.table, tc.rules)
		if !errors.Is(err, ErrInvalidConfig) {
			t.Errorf("%s: got %v, want ErrInvalidConfig", name, err)
		}
	}
}

func TestPersonMayAppearInDifferentRuleTypes(t *testing.T) {
	_, err := NewProblem(DefaultLayout(), DefaultPeople(), DefaultFrontRowScores(),
		Rules{FrontRow: []int{5}, Aisle: []int{5}, NotNear: []Pair{{5, 6}, {5, 7}}})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGridMarksAisleColumns(t *testing.T) {
	g := Grid(5, 4)
	if len(g) != 20 || g[0] != (Seat{1, 1, true}) || g[1].Aisle || g[2].Aisle || !g[3].Aisle || g[19] != (Seat{5, 4, true}) {
		t.Errorf("unexpected grid %v", g)
	}
}

func TestIsPermutation(t *testing.T) {
	if !IsPermutation(Chromosome{2, 0, 1}, 3) || IsPermutation(Chromosome{0, 0, 1}, 3) ||
		IsPermutation(Chromosome{0, 1}, 3) || IsPermutation(Chromosome{0, 1, 3}, 3) {
		t.Error("IsPermutation misjudged")
	}
}

func TestConfigValidate(t *testing.T) {
	if err := DefaultConfig().Validate(); err != nil {
		t.Fatalf("defaults invalid: %v", err)
	}
	mutations := map[string]func(*Config){
		"odd pop":     func(c *Config) { c.PopSize = 3 },
		"zero gens":   func(c *Config) { c.Generations = 0 },
		"rate high":   func(c *Config) { c.CrossoverRate = 1.1 },
		"rate nan":    func(c *Config) { c.MutationRate = nan() },
		"kill 100":    func(c *Config) { c.KillRate = 100 },
		"kill neg":    func(c *Config) { c.KillRate = -1 },
		"block 0":     func(c *Config) { c.PMXBlock = 0 },
		"bad select":  func(c *Config) { c.Selection = 9 },
		"bad cross":   func(c *Config) { c.Crossover = 9 },
		"pop too low": func(c *Config) { c.PopSize = 0 },
	}
	for name, mutate := range mutations {
		c := DefaultConfig()
		mutate(&c)
		if err := c.Validate(); !errors.Is(err, ErrInvalidConfig) {
			t.Errorf("%s: got %v", name, err)
		}
	}
}
