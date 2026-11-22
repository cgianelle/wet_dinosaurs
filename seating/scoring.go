package seating

// Scores are exact integers; Weighted100 is the weighted score in hundredths.
type Scores struct {
	Front, NearBy, Aisle, Total int
	Weighted100                 int
}

// Weighted is for printing only; ranking uses Weighted100.
func (s Scores) Weighted() float64 { return float64(s.Weighted100) / 100 }

// Chromosome holds the person index seated in each seat. It is never modified after creation.
type Chromosome []int

// Individual is a chromosome together with its scores.
type Individual struct {
	Chromosome Chromosome
	Scores     Scores
}

const (
	aisleReward        = 10
	aislePenalty       = -10
	strictCloseScore   = -30
	halfUnitsPerStep   = 5 // +/-10 per step equals 5 per half-step
	farThresholdInHalf = 2 // d > 1 step  <=>  half-units > 2
)

// Evaluate scores a chromosome against the problem.
func (p Problem) Evaluate(c Chromosome) Individual {
	seatOf := inverse(c)
	front := p.frontRowScore(seatOf)
	nearBy := p.nearByScore(seatOf)
	aisle := p.aisleScore(seatOf)
	return Individual{
		Chromosome: c,
		Scores: Scores{
			Front:       front,
			NearBy:      nearBy,
			Aisle:       aisle,
			Total:       front + nearBy + aisle,
			Weighted100: weighted100(front, nearBy, aisle),
		},
	}
}

func inverse(c Chromosome) []int {
	seatOf := make([]int, len(c))
	for seat, person := range c {
		seatOf[person] = seat
	}
	return seatOf
}

func (p Problem) frontRowScore(seatOf []int) int {
	total := 0
	for _, person := range p.rules.FrontRow {
		total += p.frontRowScores[p.layout[seatOf[person]].Row-1]
	}
	return total
}

func (p Problem) aisleScore(seatOf []int) int {
	total := 0
	for _, person := range p.rules.Aisle {
		if p.layout[seatOf[person]].Aisle {
			total += aisleReward
		} else {
			total += aislePenalty
		}
	}
	return total
}

func (p Problem) nearByScore(seatOf []int) int {
	total := 0
	for _, pair := range p.rules.NotNear {
		half := halfUnitDistance(p.layout[seatOf[pair.A]], p.layout[seatOf[pair.B]])
		total += p.proximityScore(half)
	}
	return total
}

func (p Problem) proximityScore(half int) int {
	switch {
	case half > farThresholdInHalf:
		return halfUnitsPerStep * half
	case p.rules.StrictProximity:
		return strictCloseScore
	default:
		return -halfUnitsPerStep * half
	}
}

// halfUnitDistance is |dx|+|dy|, which is twice the legacy distance d.
func halfUnitDistance(a, b Seat) int { return abs(a.Row-b.Row) + abs(a.Col-b.Col) }

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// weighted100 is the paper formula times 100:
// 0.60(F+N) + 0.10(F+I) + 0.10(N+I) + 0.04F + 0.04N + 0.02I, with no floor.
func weighted100(f, n, i int) int {
	return 60*(f+n) + 10*(f+i) + 10*(n+i) + 4*f + 4*n + 2*i
}

// IsPermutation reports whether c contains each of 0..n-1 exactly once.
func IsPermutation(c Chromosome, n int) bool {
	if len(c) != n {
		return false
	}
	seen := make([]bool, n)
	for _, v := range c {
		if v < 0 || v >= n || seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}
