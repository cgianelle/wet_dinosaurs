# Build package: DSSeating Port (Java GA to Go, bugs fixed)

**Status:** Ready for implementation
**Last updated:** 2026-10-31
**Check report:** /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/check-report.md
**Sources:**
- PRD: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/prd.md
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/ux.md
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/architecture.md

## 1. Outcome

A clean, correct, tested Go (stdlib only) port of the DSSeating genetic algorithm. It seats 20 students (A-T) in a 5x4 room under front-row, not-near and isle rules, with legacy bugs fixed. The engine is a reusable library with a generic seat layout. The CLI keeps the legacy flag names, adds `-strictprox`, `-beeplague`, `-seed` and `-out`, and writes 51 report files. A given `-seed` yields byte-identical stdout and files. The Java project is never modified. The web front end is a separate project.

## 2. Build these requirements

All P0 unless noted. Full text is in `prd.md`.

| ID | Requirement (short) | UX | ADs |
|----|---------------------|----|-----|
| FR-1 | Layout of seats (row, col), people A-T, 5x4, pop 100, gens 50 as config | 8.4 | AD-2 |
| FR-2 | Initial 100 random permutations, written as generation 5050 | 8.4 | AD-6 |
| FR-3 | Front row +10/+7/0/-7/-10 | 8.1 | AD-2, AD-4 |
| FR-4 | Near By by real coordinates; default +10d if d>1 else -10d | 8.1 | AD-4 |
| FR-5 | `-strictprox`: +10d if d>1, flat -30 if d<=1 | 8.1 | AD-4 |
| FR-6 | Isle +10 in first or last column, else -10 | 8.1 | AD-2, AD-4 |
| FR-7 | Total = F+N+I; Weighted formula, no floor | 8.4 | AD-4 |
| FR-8..10 | Selection random, queen, plague (`-killrate`) | 8.1 | AD-5 |
| FR-11 (P1) | `-beeplague` = plague then queen | 8.1 | AD-5 |
| FR-12 | PMX block 4; CX with random start per pair; applied with `-xoverrate` | 8.1 | AD-5 |
| FR-13 | Per-individual inversion mutation on a copy | 8.1 | AD-5 |
| FR-14 | Strict rate probabilities; defaults 0.9 / 0.1 / 50 | 8.3, 9 | AD-3 |
| FR-15 | 1 initial evaluation + 50 generations in fixed order | 5.1 | AD-6 |
| FR-16 | 51 files in `-out` (default `./out/`), atomic temp+rename, exit 1 on failure | 8.4 | AD-7 |
| FR-17, 18 | Legacy flags plus new; help anywhere; defaults `-random` / `-cx` | 6, 8.1, 8.3 | AD-8 |
| FR-19 | Validation, duplicates, repeats, lowercase normalized, notes | 8.3, 9 | AD-4, AD-8 |
| FR-20 | `-seed`; one injected RNG; seed always printed | 8.2 | AD-3 |
| FR-21 | Best never null, may be negative | 8.2, 8.4 | AD-4 |
| FR-22 | Unit and property tests, non-5x4 layout test | 8.1, 12 | AD-9 |
| FR-23 (P1) | Best-effort sample re-scoring; skip as "unverified" | U-1 | AD-9 |
| FR-24 | Stdout: seed, best with five scores, dir and file count; nothing else | 8.2 | AD-8 |
| FR-25 | Single stderr line `dsseating: error: <msg>`; exit 2 usage, 1 I/O or internal | 8.3, 8.5 | AD-8 |

## 3. Experience to implement

The UX is a CLI with no screens. The surfaces are help (S1), run summary (S2), errors and notes (S3), the report file (S4) and exit codes (S5). Follow the exact text and catalogue in `ux.md` section 8.

- Happy path: parse and validate all argv, create the out dir, run, write 51 files, print the 8-line summary (`Seed: n`, `Best Individual:` + five scores, `Wrote 51 files to <dir as typed>`), exit 0.
- Critical states:
  - Help (`-h`, `-help`, `--help` anywhere, or no args) goes to stdout, exit 0, and wins over other errors.
  - Errors are one line on stderr, the first violation left to right, exit 2.
  - I/O failures are one line, exit 1; the temp file is removed.
  - Notes are single stderr lines, exit 0.
  - There is no progress or loading output.
- Help text: at most 90 columns per line, plain text, no pager. It is generated from the same defaults constants as the parser. A test asserts every flag is mentioned, "default" appears next to `-random` and `-cx`, and no line exceeds 90 columns.
- Accessibility: plain ASCII, no color or ANSI, one fact per line, self-contained single-line messages with the fix in a trailing parenthetical, no prompts, never reads stdin.

## 4. Architecture to follow

- Paradigm: functional core (`seating`) with thin adapters (`report`, `internal/cli`).
- Structural seed: `cmd/dsseating/main.go` (shim), `internal/cli`, `report`, `seating`, `go.mod` (module `dsseating`, go 1.27, no requires), `README.md`.
- Binding ADs:
  - AD-1: `seating` imports no `os`, `io/fs`, `flag`, `time`, `bufio` or `log` and does not print. `report` imports only `seating`, `io`, `strconv` and `strings`. `cli.Run(args, stdout, stderr) int`. A `go list` test enforces the import rules.
  - AD-2: `Seat{Row, Col, Aisle}`, `Layout []Seat`, `Grid(rows, cols)`. `FrontRowScores` is a per-row table on the config. Rule sets use person indices.
  - AD-3: one `*rand.Rand` (`math/rand/v2` PCG, fixed second word); a rate fires iff `Float64() < rate`; the draw is always consumed.
  - AD-4: integer half-unit distance; `Weighted100` integer; best = strict `>` scan; `NewProblem` rejects duplicates.
  - AD-5: pure, copy-on-write operators that are valid by construction; `Run` verifies permutations.
  - AD-6: `Run(p, c, rng, observe)`. Order is select, cross adjacent pairs, mutate, score, observe, with generations -1 then 0..49.
  - AD-7: `report.Write` and `report.FileName`. 49-underscore separator, LF endings. The CLI does the atomic temp-file and rename.
  - AD-8: hand-rolled table-driven parser; help first; conflicts counted by occurrence; one error type and format; notes; stdout from one pure function.
  - AD-9: `go test ./...` is deterministic. The D17 quality check is behind build tag `quality`. Sample tests are skippable and tolerate CRLF.
- Stack pins: Go 1.27.3, stdlib only, no cgo, macOS and Linux.
- Owning contexts: Seating Engine (`seating`) owns FR-1..15 and 21. Report (`report`) owns the FR-16 format. CLI (`internal/cli`) owns FR-16 atomic writes and FR-17..20, 24, 25.
- Ubiquitous language:

| Term | Meaning | Do not call it |
|------|---------|----------------|
| Layout / Seat | List of seats with Row, Col (1-based, row 1 front) and Aisle | grid, room, slot, desk |
| Person | A people-list entry with Label; "student" in user text | member, attendee |
| Chromosome | Permutation of people over seats | genome, string |
| Individual | Chromosome plus scores (`Individual:` in reports) | phenotype |
| Population | Exactly `PopSize` Individuals; one report file | generation |
| Generation | Index: -1 (file 5050), then 0..49 | step, epoch |
| Rule set | `-frontrow`, `-proximity`, `-isle`; "rules" in user text | constraints |
| Report labels | Front Row, Near By, Isle, Total Fitness, Weighted Score | any rename; code says `Aisle` |
| Mating pool | `PopSize` Individuals, adjacent slots mated | parents list |
| Queen | Best Individual of the population being selected from | elite |
| Kill rate | Integer percent removed by plague | cull rate |

## 5. Non-functional constraints

- Default run well under 1 s (a benchmark, not an assertion); buffered writes.
- Same seed and args give byte-identical stdout and files (same Go version and OS).
- Stdlib only, no cgo, `go.sum` empty. `gofmt` and `go vet` clean.
- No panic reaches the user; `cli.Run` alone recovers (exit 1). Input-dependent conditions return errors.
- Never write to the Java folder. Reports go to `-out`, never the CWD.
- 0 permutation violations in 1000 or more property-test runs.

## 6. Out of scope

Web front end; GUI; non-grid topologies; CLI flags for rows, cols, gens or pop; other constraint types; varying PMX block size, "village idiot" anti-convergence, per-generation selection switch; stdout seating grid; JSON output; reproducing Java random streams; Rust port; byte-exact Java number formatting.

## 7. Do not invent

- **Open:** U-11 / R-8 (keep earlier completed files after a write failure, default keep) and U-10 (identical repeated selection or crossover flag is an exit-2 error, default error) are unconfirmed by the owner. Implement the defaults and do not change them silently.
- **Assumed (treat as given unless contradicted by code):**
  - LF line endings in reports; the sample parser trims `\r`.
  - Edit-distance 2 "did you mean" hint is optional.
  - A value token equal to a known option name counts as a missing value.
  - Queen "others" are drawn with replacement, excluding the queen.
  - PMX block start is uniform in `[0, n-4]`.
  - The separator is 49 underscores.
  - Seed is a non-negative `uint64`.
  - Q/R/S rule sets are entered as pairs.
- Do not add stdout lines beyond the FR-24 three items.
- Do not add flags beyond the PRD list.
- Do not assert exact RNG streams in tests.
- Use the UX error catalogue wording; change tests and wording together.

## 8. Suggested implementation order

1. `go.mod`; `seating` types (Layout, Seat, Person, Problem, Config, defaults) with `Grid` and `NewProblem` validation.
2. Scoring with integer arithmetic (FR-3..7, 21) and hand-computed tests, including both proximity modes and a non-5x4 layout.
3. Operators (selection x4, PMX, CX, mutation) with validity property tests; `Run` and `observe`.
4. `report` (format, `FileName`) with a golden test.
5. `internal/cli`: parser, help (90 columns max), summary, errors, notes, atomic writer, `main` shim; tests for argv, determinism and exit codes.
6. Sample tests (skippable), the `quality`-tagged D17 check, and the README.
