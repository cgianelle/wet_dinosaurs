package solver

import (
	"context"
	"testing"
)

// BenchmarkSolveIrregular50 measures a Run on a 50-desk irregular room (AD-8, build step 3).
func BenchmarkSolveIrregular50(b *testing.B) {
	req := irregularRoom()
	for i := 0; i < b.N; i++ {
		if _, err := Solve(context.Background(), req, Options{}); err != nil {
			b.Fatal(err)
		}
	}
}
