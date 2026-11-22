package seating

import "math/rand/v2"

// pmx performs partially mapped crossover on a random block of min(block, n) positions.
func pmx(a, b Chromosome, rng *rand.Rand, block int) (Chromosome, Chromosome) {
	n := len(a)
	block = min(block, n)
	start := rng.IntN(n - block + 1)
	end := start + block
	return pmxChild(a, b, start, end), pmxChild(b, a, start, end)
}

// pmxChild takes positions [start,end) from donor and fills the rest from base,
// following the position mapping so the child stays a permutation.
func pmxChild(base, donor Chromosome, start, end int) Chromosome {
	child := make(Chromosome, len(base))
	copy(child[start:end], donor[start:end])
	baseValueFor := make(map[int]int, end-start) // donor value -> base value at the same position
	for i := start; i < end; i++ {
		baseValueFor[donor[i]] = base[i]
	}
	for i := range child {
		if i >= start && i < end {
			continue
		}
		value := base[i]
		for {
			mapped, inBlock := baseValueFor[value]
			if !inBlock {
				break
			}
			value = mapped
		}
		child[i] = value
	}
	return child
}

// cycleCrossover starts the cycle at a random position; child one takes the cycle from a, child two from b.
func cycleCrossover(a, b Chromosome, rng *rand.Rand) (Chromosome, Chromosome) {
	inCycle := cyclePositions(a, b, rng.IntN(len(a)))
	x := make(Chromosome, len(a))
	y := make(Chromosome, len(a))
	for i := range a {
		if inCycle[i] {
			x[i], y[i] = a[i], b[i]
		} else {
			x[i], y[i] = b[i], a[i]
		}
	}
	return x, y
}

func cyclePositions(a, b Chromosome, start int) []bool {
	positionInA := make([]int, len(a))
	for i, v := range a {
		positionInA[v] = i
	}
	inCycle := make([]bool, len(a))
	for pos := start; !inCycle[pos]; pos = positionInA[b[pos]] {
		inCycle[pos] = true
	}
	return inCycle
}

// mutate reverses a random range of a copy with probability rate. The rate draw is always consumed.
func mutate(c Chromosome, rate float64, rng *rand.Rand) Chromosome {
	fires := rng.Float64() < rate
	out := append(Chromosome(nil), c...)
	if !fires || len(c) < 2 {
		return out
	}
	i := rng.IntN(len(c))
	j := rng.IntN(len(c) - 1)
	if j >= i {
		j++
	}
	if i > j {
		i, j = j, i
	}
	for ; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}
