package seating

// Pair is an unordered pair of person indices that should not sit near each other.
type Pair struct{ A, B int }

// Rules are the seating wishes, expressed with person indices.
type Rules struct {
	FrontRow        []int
	NotNear         []Pair
	Aisle           []int
	StrictProximity bool
}

// Problem is an immutable, validated seating problem.
type Problem struct {
	layout         Layout
	people         []Person
	frontRowScores []int
	rules          Rules
}

// NewProblem validates its inputs and copies them so the Problem stays immutable.
func NewProblem(layout Layout, people []Person, frontRowScores []int, rules Rules) (Problem, error) {
	if err := validateShape(layout, people, frontRowScores); err != nil {
		return Problem{}, err
	}
	if err := validateRules(len(people), rules); err != nil {
		return Problem{}, err
	}
	return Problem{
		layout:         append(Layout(nil), layout...),
		people:         append([]Person(nil), people...),
		frontRowScores: append([]int(nil), frontRowScores...),
		rules: Rules{
			FrontRow:        append([]int(nil), rules.FrontRow...),
			NotNear:         append([]Pair(nil), rules.NotNear...),
			Aisle:           append([]int(nil), rules.Aisle...),
			StrictProximity: rules.StrictProximity,
		},
	}, nil
}

// Size is the number of seats, which equals the number of people.
func (p Problem) Size() int { return len(p.layout) }

// People returns a copy of the people list.
func (p Problem) People() []Person { return append([]Person(nil), p.people...) }

func validateShape(layout Layout, people []Person, frontRowScores []int) error {
	if len(layout) == 0 {
		return invalidf("layout has no seats")
	}
	if len(people) != len(layout) {
		return invalidf("%d people for %d seats", len(people), len(layout))
	}
	maxRow := 0
	for _, seat := range layout {
		if seat.Row < 1 || seat.Col < 1 {
			return invalidf("seat (%d,%d) must have row and column of at least 1", seat.Row, seat.Col)
		}
		maxRow = max(maxRow, seat.Row)
	}
	if len(frontRowScores) != maxRow {
		return invalidf("front-row score table has %d entries for %d rows", len(frontRowScores), maxRow)
	}
	return validateLabels(people)
}

func validateLabels(people []Person) error {
	seen := make(map[string]bool, len(people))
	for _, person := range people {
		if person.Label == "" {
			return invalidf("person label is empty")
		}
		if seen[person.Label] {
			return invalidf("person label %q is repeated", person.Label)
		}
		seen[person.Label] = true
	}
	return nil
}

func validateRules(n int, rules Rules) error {
	if err := validatePersonList("front-row", n, rules.FrontRow); err != nil {
		return err
	}
	if err := validatePersonList("aisle", n, rules.Aisle); err != nil {
		return err
	}
	return validatePairs(n, rules.NotNear)
}

func validatePersonList(name string, n int, list []int) error {
	seen := make(map[int]bool, len(list))
	for _, person := range list {
		if person < 0 || person >= n {
			return invalidf("%s rule names person %d outside 0..%d", name, person, n-1)
		}
		if seen[person] {
			return invalidf("%s rule repeats person %d", name, person)
		}
		seen[person] = true
	}
	return nil
}

func validatePairs(n int, pairs []Pair) error {
	seen := make(map[Pair]bool, len(pairs))
	for _, pair := range pairs {
		if pair.A < 0 || pair.A >= n || pair.B < 0 || pair.B >= n {
			return invalidf("not-near rule names person outside 0..%d", n-1)
		}
		if pair.A == pair.B {
			return invalidf("not-near rule pairs person %d with themselves", pair.A)
		}
		key := Pair{A: min(pair.A, pair.B), B: max(pair.A, pair.B)}
		if seen[key] {
			return invalidf("not-near rule repeats pair %d,%d", key.A, key.B)
		}
		seen[key] = true
	}
	return nil
}
