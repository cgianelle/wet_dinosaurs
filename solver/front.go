package solver

import "dsseating/seating"

// FrontScores stretches the legacy front-row curve {10, 7, 0, -7, -10} over rows rows by
// integer linear interpolation (AD-3). Five rows reproduce the legacy table; one row gives {10}.
func FrontScores(rows int) []int {
	anchors := seating.DefaultFrontRowScores()
	if rows <= 1 {
		return []int{anchors[0]}
	}
	span := rows - 1
	last := len(anchors) - 1
	scores := make([]int, rows)
	for k := range scores {
		segment, remainder := (last*k)/span, (last*k)%span
		scores[k] = anchors[segment]
		if remainder != 0 {
			scores[k] += divideRoundingAway((anchors[segment+1]-anchors[segment])*remainder, span)
		}
	}
	return scores
}

// divideRoundingAway divides by a positive denominator, rounding halves away from zero.
func divideRoundingAway(numerator, denominator int) int {
	if numerator < 0 {
		return -divideRoundingAway(-numerator, denominator)
	}
	return (2*numerator + denominator) / (2 * denominator)
}
