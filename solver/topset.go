package solver

import (
	"slices"

	"dsseating/seating"
)

// topSet keeps the best few distinct individuals offered over a whole run (AD-7).
// Higher Weighted100 wins; on a tie the individual offered first stays ahead.
type topSet struct {
	capacity int
	members  []seating.Individual
}

func newTopSet(capacity int) *topSet { return &topSet{capacity: capacity} }

func (s *topSet) offer(candidate seating.Individual) {
	if s.contains(candidate.Chromosome) {
		return
	}
	at := s.insertionPoint(candidate.Scores.Weighted100)
	if at >= s.capacity {
		return
	}
	candidate.Chromosome = slices.Clone(candidate.Chromosome)
	s.members = slices.Insert(s.members, at, candidate)
	if len(s.members) > s.capacity {
		s.members = s.members[:s.capacity]
	}
}

func (s *topSet) contains(chromosome seating.Chromosome) bool {
	return slices.ContainsFunc(s.members, func(m seating.Individual) bool {
		return slices.Equal(m.Chromosome, chromosome)
	})
}

// insertionPoint is the first position whose score is strictly lower, so earlier offers win ties.
func (s *topSet) insertionPoint(weighted100 int) int {
	for i, member := range s.members {
		if member.Scores.Weighted100 < weighted100 {
			return i
		}
	}
	return len(s.members)
}

func (s *topSet) ranked() []seating.Individual { return slices.Clone(s.members) }
