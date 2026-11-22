# Implementation report: DSSeating Port (Java GA to Go, bugs fixed)

**Status:** PASS
**Last updated:** 2026-10-31
**Sources:**
- Build package: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/build-package.md
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/ux.md
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/architecture.md
- Files reviewed: go.mod, README.md, cmd/dsseating/main.go; seating/*.go (layout, problem, config, scoring, selection, operators, run, and tests incl. quality-tagged); report/report.go and test; internal/cli/*.go and tests; internal/archtest/imports_test.go (all under /Users/cgianelle/Projects/dsseating-port)

## Verdict

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 0 | 0 | 7 |

## 1. Sound

Craft is good: small functions, intention-revealing names, named constants for the scoring magic numbers, pure copy-on-write operators, one error type, no globals. `gofmt -l` is empty and `go vet` is clean. `go.sum` is absent and `go.mod` has no `require`. The Java folder was only read (sample test opens it read-only).

| ID | Severity | Owner | Finding | Resolution needed |
|----|----------|-------|---------|-------------------|
| S-1 | Note | clean-code | `Problem.People()` (seating/problem.go) is exported, unused and untested (G9, YAGNI). | Remove or use it. |
| S-2 | Note | clean-code | `parser.setSelection` and `setCrossover` (internal/cli/parse.go) build a map literal on every call, and `applyGroup` takes six parameters including a closure (F1, G30). | Use package-level lookup tables or return the kind from the spec. |
| S-3 | Note | clean-code | `itoa` wrapper in internal/cli/run.go is only used by writer.go; `strconv.Itoa` is already imported elsewhere in the package (G5). | Inline it. |

## 2. Spec met

All FRs verified by reading the code and by running the built binary (seeded run, duplicate-output diff, error and note cases).

| ID | Source | Status | Gap |
|----|--------|--------|-----|
| FR-1, AD-2 | layout.go, problem.go | met | `Seat{Row,Col,Aisle}`, `Grid`, per-row `FrontRowScores`, person indices; non-5x4 layout tests present. |
| FR-2, FR-15, AD-6 | run.go | met | Initial population as generation -1 (file 5050), then select, cross adjacent pairs, mutate, score, observe 0..49; verify per population. |
| FR-3..7, FR-21, AD-4 | scoring.go | met | Integer half-unit distance, strict-prox flat -30, `Weighted100`, no floor, strict `>` best scan, inverse array per evaluation, `NewProblem` rejects duplicates. |
| FR-8..11, AD-5 | selection.go | met | Random, queen (others exclude queen), plague (stable, higher index first), beeplague. |
| FR-12, FR-13 | operators.go | met | PMX block min(4,n) uniform start; CX random start per pair; mutation on a copy; rate draw always consumed. |
| FR-14, FR-20, AD-3 | config.go, cli/run.go | met | PCG with fixed second word, `Float64() < rate`, defaults 0.9/0.1/50 from `DefaultConfig`. |
| FR-16, AD-7 | report.go, cli/writer.go | met | 49-underscore separator, LF, `FileName`, temp file in out dir, Sync, chmod, rename, temp removed on error, earlier files kept (U-11 default). |
| FR-17, FR-18, AD-8 | spec.go, parse.go, help.go | met | Hand-rolled table-driven parser, help anywhere or no args wins, defaults `-random`/`-cx`, help generated from defaults, 90 columns tested. |
| FR-19 | parse.go | met | Duplicates, repeats, conflicts by occurrence (U-10 default), lowercase normalized, option-name-as-value is a missing value, `-seed -5` gives the seed error, notes in fixed order. |
| FR-22 | tests | met | Hand-computed scoring, both proximity modes, non-5x4, 1500-run PMX/CX validity properties, all selection x crossover combinations, determinism, golden report. |
| FR-23 (P1) | samples_test.go | met | Skippable, CRLF tolerant, weighted formula checked on 1205 recorded individuals; other re-scoring reported as unverified. |
| FR-24 | cli/output.go | met | Eight-line summary from one pure function sharing `report.BestBlock`; verified manually. |
| FR-25, S5 | errors.go, run.go | met | `dsseating: error: <msg>`, exit 2 usage / 1 I/O and internal, `Run` alone recovers. |
| AD-1 | archtest | met | `go list` tests enforce `seating` and `report` imports and stdlib-only. |
| AD-9 | quality_test.go | met | Behind tag `quality`; passes. Default `go test ./...` has no wall-clock assertions. |
| Ubiquitous language | all | met | `Aisle` in code, `Isle` in user text; Layout, Seat, Person, Chromosome, Individual, Population, Generation, Queen, KillRate used consistently; no silent synonyms found. |

## 3. Tests and coverage

- Test command: `export PATH=$PATH:/opt/homebrew/bin; go vet ./...; go test -count=1 -cover ./...; go test -count=1 -race ./...; go test -count=1 -tags quality ./seating/`
- Result: pass (vet clean; all packages ok; race clean; quality-tagged test ok; sample test ran and passed against the Java reports).
- Coverage (tool printed): seating 97.2%, report 100.0%, internal/cli 93.9%, total 95.7%; cmd/dsseating 0.0% (ten-line shim). New/changed code covered: yes.
- Test-first evidence cannot be verified (not a git repo); the suite pins behaviour at each boundary (boundary rates, 0/99 kill rate, ties, single survivor, file-as-out-dir, write failure, panic path) and does not look bolted on.

| ID | Severity | Finding | Resolution needed |
|----|----------|---------|-------------------|
| T-1 | Note | Uncovered branches: `verify` failure path in seating/run.go (66.7%), `classify` ErrInvalidConfig and default branches (60%), `remainder` singular and plural cases, some `writeAtomically` error branches. The first is a by-construction safety net. | Optional: add a test with a fake corrupt population or a direct `classify` table test. |
| T-2 | Note | Determinism test repeats 3 times; architecture asks for 10 repeats. | Raise the loop count. |
| T-3 | Note | NFR "well under 1 s" is specified as a benchmark; no `Benchmark*` exists. The default run is visibly instant. | Add a one-function benchmark. |

## Issues

### Blockers

None.

### Warnings

None.

### Notes

1. S-1: unused `Problem.People()`.
2. S-2: per-call map literals and six-parameter `applyGroup` in parse.go.
3. S-3: redundant `itoa` wrapper.
4. T-1: a few defensive branches untested.
5. T-2: determinism test runs 3 repeats, not 10.
6. T-3: no benchmark for the performance NFR.
7. `-out` temp-file glob and open questions U-10 / U-11 follow the documented defaults; no silent change.
