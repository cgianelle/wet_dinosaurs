# seating — engine rules

Pure library; the future web project imports it. Full rationale: `docs/dsseating-port/architecture.md` AD-2..AD-6.

## Purity
- Imports: pure stdlib only (`math/rand/v2`, `slices`/`sort`, `errors`, `fmt` for error values). `internal/archtest` enforces this.
- No printing, files, clock, flags, or package-level mutable state.
- Input errors return an error wrapping `ErrInvalidConfig` (`%w`); never panic on input.

## Randomness
- Every function that draws takes `rng *rand.Rand` as a parameter. No global `rand`, no `time`.
- A rate event is `rng.Float64() < rate`; always consume the draw, even at 0 or 1.
- Phase order per generation is fixed: selection draws, then crossover (pairs in order), then mutation (individuals in order).

## Data
- `Chromosome` = `[]int` of person indices by seat index; never modified after creation. Operators return new slices; copy before changing.
- `Problem` is built once by `NewProblem` (validates, rejects duplicate rule entries) and never mutated.
- Rules use person indices; label strings are resolved by the caller, never inside the engine.

## Scoring
- Read only `Seat.Row`, `Seat.Col`, `Seat.Aisle`. Never reference 5, 4, or grid size — layouts can be non-5x4.
- Distance is in half-units (`|dr|+|dc|`) so all scores stay `int`. No floats in scoring or ranking.
- Compare `Weighted100`; ties go to the lowest index (strict `>` scan). No floor at 0.
- Rebuild the person-to-seat inverse per evaluation; no coordinate state carries between individuals.

## Tests
- Assert properties (valid permutation, counts, ranges, same seed twice = same result), never exact RNG streams.
- Scoring tests use hand-computed cases; each fixed legacy bug has a named test.
- The quality check stays behind the `quality` build tag; sample tests skip when `$DSSEATING_SAMPLES` is absent.
