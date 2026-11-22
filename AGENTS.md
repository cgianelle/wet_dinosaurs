# AGENTS.md — dsseating

Go port of the 2003 DSSeating genetic algorithm: seats 20 students (A-T) in a 5x4 room using
front-row, not-near (proximity) and aisle ("Isle") rules. Legacy Java bugs are **fixed on purpose**.
A web front end is a separate future project that will import the `seating` package.

Deep detail: [README.md](README.md) (usage, output format) and `docs/dsseating-port/`
(`architecture.md` = binding rules AD-1..AD-9; `prd.md` = owner decisions D1-D18 and FRs; `ux.md` = exact CLI text).
`docs/dsseating-port/_archive-round1/` is **stale** (it assumed "preserve bugs") — do not follow it.

## Layout and ownership

| Path | Owns | Must not |
| --- | --- | --- |
| `seating/` | Pure engine: layout, scoring, selection, crossover, mutation, `Run` | Import `os`, `io/fs`, `flag`, `time`, `bufio`, `log`; print; hold package state. See `seating/CLAUDE.md` |
| `report/` | Legacy text format and file names (`Write`, `FileName`, `BestBlock`) | Import anything but `seating`, `io`, `strconv`, `strings`; touch files |
| `internal/cli/` | argv parsing (hand-rolled table in `spec.go`), help, notes, errors, exit codes, atomic file writes, clock seed | — the only package that writes stdout/stderr or files |
| `cmd/dsseating/` | Ten-line shim: `os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr))` | Grow logic |
| `solver/` | Web facade: room to `seating.Problem`, top-3 set, outcomes, seed, wire types (`docs/dsseating-web/architecture.md` AD-1..AD-7) | Import anything but `seating` and pure stdlib |
| `internal/api/`, `cmd/dsseating-server/` | HTTP shell and server shim | Import `seating`, `report`, `internal/cli` |
| `web/`, `contract/fixtures/` | React app and shared contract fixtures; built and tested only through Docker Compose | Compute scores or outcomes; call `fetch` outside `web/src/solver` |
| `internal/archtest/` | `go list` test enforcing the import rules above and stdlib-only | Be weakened to make a change pass |

Dependency direction: `cmd → internal/cli → report → seating`. Never the reverse.

## Stack and commands

Go 1.27 (`go.mod`: `module dsseating`, no `require`), **standard library only**, macOS and Linux.

```bash
go build ./cmd/dsseating
go vet ./... && go test ./...                         # the gate; must be green, gofmt clean
go test -tags quality -run Quality -v ./seating      # strict-mode quality check, informational, opt-in
```

- Sample tests read the read-only Java reports from `$DSSEATING_SAMPLES`
  (default `/Users/cgianelle/Projects/DSSeating_10_10_03`) and skip as "unverified" when absent.
- `./dsseating` and `./out/` in the root are build/run output, not source.

## Invariants (never break)

- **Determinism:** same argv + `-seed` gives byte-identical stdout and files. One `*rand.Rand`
  (PCG, fixed second word in `internal/cli/run.go`); no map iteration on output paths; single goroutine.
- **Scores are integers.** Ranking compares `Scores.Weighted100` only; `Weighted()` is for printing.
  No floor at 0 — negative weighted scores are valid (D7, D16).
- **Defaults live once** in `seating.DefaultConfig()`, `DefaultPeople()`, `DefaultLayout()`,
  `DefaultFrontRowScores()`. CLI help is generated from them — never hardcode defaults in `cli`.
  Defaults: `-random` selection, `-cx` crossover.
- **Report format is frozen** (D4): 51 files (`Generation5050.txt` = initial, then `Generation0..49.txt`,
  not zero-padded), labels incl. the spelling "Isle", 49-underscore separator, LF endings.
- **Naming:** code says `Aisle` and `Person`; user-visible text says `Isle` and "student". Flag names are legacy and fixed.
- **CLI contract:** errors are one stderr line `dsseating: error: <message>` naming the bad token;
  notes are `dsseating: note: <message>`. Exit 0 success/help, 2 usage/validation/`ErrInvalidConfig`,
  1 I/O or internal. Only `cli.Run` recovers panics. Help (`-h`, `-help`, `--help`, or no args) beats every error.
- **Strictness:** conflicting or repeated selection/crossover flags, repeated scalar flags, and duplicate
  rule entries are exit-2 errors — never last-wins, never scored twice.
- **Atomic writes:** temp file in the out dir, then rename; a final report name never holds partial content.

## Agent do / don't

- Do change the exact CLI wording only together with `ux.md` and the golden tests.
- Do add a named test for any behavior fix; assert properties, not exact RNG output.
- Don't add third-party modules, `flag`, or float math in scoring.
- Don't modify the Java project; it is read-only reference.
- Don't refactor `report` toward the web project; replace it with a new adapter when a non-CLI consumer exists (AD-7).

## Decisions already made (don't relitigate)

- Bugs fixed; "correct" = the design paper, else obvious intent (D2). Matching Java random streams or Java number formatting: rejected.
- Proximity: legacy scoring by default; `-strictprox` gives a flat -30 when close (D5).
- stdlib `flag` rejected (can't express two-value `-proximity`, help-anywhere, conflict errors) — AD-8.
- Single `main` package and `internal/` engine rejected — the web project must import `seating` (AD-1).
- Topology interfaces, RNG interfaces, operator strategy interfaces: deferred until a second implementation exists.
- Deferred features: `-rows/-cols/-gens/-pop` flags, non-grid layouts, JSON output, other constraint types.

## Known follow-ups

Open notes S-1..S-3 and T-1..T-3 in `docs/dsseating-port/implementation-report.md` (e.g. unused `Problem.People()`, determinism test runs 3 repeats instead of 10, no benchmark).
