# PRD: DSSeating Port (Java GA to Go, bugs fixed)

**Status:** Draft
**Author:** product-manager agent (owner decisions relayed 2026-10-31)
**Last updated:** 2026-10-31
**Slug:** dsseating-port

**Revision note (round 3):** Open questions OQ-1..OQ-4 closed by the owner (decisions D15-D18). The median-best quality target is dropped as a requirement and kept as an informational comparison; the strict-mode target is a pass/fail check, not a build blocker. Status stays Draft.

Supersedes the round-1 drafts in `_archive-round1/` (reference only; they assumed "preserve bugs", which the owner reversed).

## Revision delta (spec round 1, for owner review at Gate 1b)

D1-D18 are unchanged. Items marked (R) are recommended defaults the owner has not explicitly confirmed.

| # | Change | Where | Closes |
|---|--------|-------|--------|
| 1 | Default selection when no selection flag is given is `-random`; stated in FR-17 and FR-18. | FR-17, FR-18 | W-1 |
| 2 | Rule-set duplicates are exit-2 errors (in the spirit of D15): a label repeated in `-frontrow`, a label repeated in `-isle`, a `-proximity` pair repeated (unordered, so `Q R` and `R Q` collide), and `-proximity X X`. Nothing is "scored twice". A label may appear in different rule types. (R) | FR-19 | B-2, W-2 |
| 3 | Repeated scalar flags (`-seed`, `-out`, `-xoverrate`, `-mutrate`, `-killrate`, `-strictprox`) are exit-2 errors. (R) | FR-19 | B-2, W-2 |
| 4 | `-help` and `--help` are accepted as aliases of `-h`; help anywhere prints help, runs nothing, exits 0; no arguments prints help, exits 0. Help takes precedence over other errors. (R) | FR-17 | W-2 |
| 5 | Lowercase student labels are accepted and normalized to uppercase (the paper writes them lowercase); labels outside A-T remain errors. (R) | FR-19 | W-2 |
| 6 | Non-fatal stderr notes (exit stays 0): `-killrate` without `-plague`/`-beeplague`; `-strictprox` with no `-proximity` rule; no rules given at all. (R) | FR-19 | W-2 |
| 7 | Atomic report writes: each file is written to a temporary name in the output dir then renamed; on failure partial files are removed and exit is 1. Existing report files of the same name are overwritten. (R) | FR-16 | W-2 |
| 8 | Stdout contract fixed at PRD level: seed line (always printed, whether given or time-derived), best result, output directory and file count. Exact layout is UX's. (FR-20 previously printed the seed only when omitted.) | FR-24 (new), FR-20 | B-1 |
| 9 | One error format: single line on stderr `dsseating: error: <message>`, message names the offending token or file; usage/validation errors exit 2, I/O and internal errors exit 1; no stack traces or panics reach the user. | FR-25 (new), FR-19 | B-3 |

## 0. Decisions (owner, authoritative)

| # | Decision |
|---|----------|
| D1 | Language: Go (1.27.3 installed). Standard library only. New folder `/Users/cgianelle/Projects/dsseating-port/`; the Java original is never modified. |
| D2 | Legacy bugs are FIXED now. "Correct" is defined by the design paper (`SWENG584_GA_ClassRoomDistribution_V0003.pdf`) where it speaks, otherwise by obvious intent. |
| D3 | Help text matches code behavior: cycle crossover (CX) is the default. |
| D4 | Keep all 51 report files (`Generation5050.txt` initial + `Generation0..49.txt`), the report labels (including the spelling "Isle"), and the legacy flag names. |
| D5 | Proximity penalty is toggled by a new flag `-strictprox`. Default = legacy scoring (+10d when d > 1, -10d when d <= 1). With `-strictprox`: +10d when d > 1, flat -30 when d <= 1. Coordinate/lookup bug fixes apply in both modes. |
| D6 | Front-row scores: +10, +7, 0, -7, -10 (code values, not the paper's -10 for row 4). |
| D7 | Weighted score floor at 0 is REMOVED (scores may be negative). |
| D8 | BeePlague (plague, then queen bee on survivors) is added as a fourth selection, this iteration. |
| D9 | CX starting position varies per mating pair; PMX block size stays 4. |
| D10 | Mutation is a per-individual probability (paper 4.4.2). |
| D11 | Exact Java number formatting is not required; shortest round-trip decimal is fine. |
| D12 | `-seed` default behavior accepted; performance: no hard target beyond "instant". |
| D13 | Verification is a unit-test suite (no separate harness). Sample-file re-scoring is best-effort. |
| D15 | Conflicting selection flags (more than one of `-random`, `-queen`, `-plague`, `-beeplague`) or conflicting crossover flags (`-pmx` with `-cx`) FAIL with an error and exit 2; not last-wins. |
| D16 | Negative Weighted Scores are acceptable in reports. |
| D17 | Quality target: only the strict-mode check remains (in `-strictprox` mode, the best seating has no close Q/R/S pair in at least 90% of 30 seeded runs on the paper's rule set). Thresholds are calibrated after the first measurement and reported as pass/fail, not a build blocker. The median best >= 96.92 comparison is informational only. |
| D18 | CX cycle start is a random pick from the seeded RNG (random crossover points), reproducible via `-seed`. |
| D14 | The web front end is a SEPARATE project, out of scope here; it will start with the brainstorming skill. This engine keeps only a generic seat-layout seam. |

## 1. Problem Statement

DSSeating (2003, SWENG584 grad project, Java) uses a genetic algorithm (GA) to seat 20 students (A-T) in a 5-row x 4-column classroom under a teacher's rules: some students want the front rows, some must not sit near each other, some must sit on an outside aisle seat. The original is a single ~2200-line class with copy-pasted per-row logic, many time-seeded RNG instances (correlated, non-reproducible), a hardcoded 100-individual / 50-generation run, 51 report files written into the working directory, and a number of bugs. The original machine and toolchain are gone, so the source, a paper, and sample output files are all that remain.

The owner wants a clean, correct, testable Go port in a separate folder. The engine should be reusable as a library, since the longer-term vision (a separate project) is a web tool for people to lay out their own seating, including event planners.

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Correct GA | Unit tests for fitness functions and for every fixed quirk (section 9, Decisions D2) | 100% of listed fixes have a failing-before/passing-after test; `go test ./...` green |
| Valid output always | Every chromosome produced by init, selection, crossover and mutation is a permutation of the people | 0 violations in property tests over >= 1000 random runs |
| Reproducible | Same seed + same args produce byte-identical report files and stdout | 100% over 10 repeated runs |
| Strict mode works (D17) | Paper's rule set (front A,D,F,I,L,P,R; not-near Q,R,S; isle F) with `-strictprox`, 30 seeded runs | Best seating has no Q/R/S pair within d <= 1 in >= 90% of runs; thresholds calibrated after first measurement; pass/fail check, not a build blocker |
| Informational only | Same rule set, CX, default mode, 30 seeds | Median best weighted score compared with the paper's 96.92; not a requirement |
| Fast | Default run (pop 100, 50 gens) | Completes well under 1 s on the dev machine |
| Reusable engine | Engine package has no CLI, file, or global state; accepts layout, people, constraints, config, RNG | Demonstrated by tests that run a non-5x4 layout |

Non-goals: web front end, GUI, round tables or non-grid topologies, Rust port, reproducing Java random streams, modifying the Java project.

## 3. Users & Use Cases

- **Primary user:** the project owner (and any teacher-style operator) running the CLI with seating rules and reading the `Generation*.txt` reports.
- **Secondary user:** a developer extending the engine, who will build the separate web project on it (needs a clean library, tests, and the seat-layout seam).

Today: `DSSeating.jar` / `.exe` run with switches (`-frontrow A -proximity Q R -isle F -plague -pmx -xoverrate 0.85 -mutrate 0.05 -killrate 75`), producing `GenerationN.txt` files in the CWD. No GUI exists; `UI()` is only help text.

### Terminology
Report labels and flag spelling keep the legacy "Isle": `Front Row Score`, `Near By Score`, `Isle Score`, `Total Fitness Score` (sum of the three), `Weighted Score`; flag `-isle`. Code identifiers may say "aisle".

## 4. Functional Requirements

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1 | The engine models a layout as a list of seats (each with row and column), defaulting to 5 rows x 4 columns, and a list of people (default A-T). A chromosome is a permutation of people over seats. Class size, layout, population (100) and generations (50) are configuration with those defaults. | P0 | Generic seat-layout seam for the later web project. No flags for size this iteration. |
| FR-2 | Initial population: 100 random valid permutations, scored and written as generation 5050. | P0 | |
| FR-3 | Front-row score per `-frontrow X` student: row 1 +10, row 2 +7, row 3 0, row 4 -7, row 5 -10. | P0 | D6. Repeatable switch. |
| FR-4 | Near By score per `-proximity X Y` pair, with d = (abs(dx)+abs(dy))/2 computed from each student's real seat coordinates (lookup by seat, no copy-paste branches, no stale coordinates). Default mode: d > 1 gives +10d, else -10d. Truncated to int as in legacy. | P0 | D5. Fixes the row-5 coordinate bug and stale-coordinate bug. |
| FR-5 | With `-strictprox`, Near By score per pair is +10d when d > 1, and a flat -30 when d <= 1. | P0 | D5. Flag name chosen to match legacy single-token style. |
| FR-6 | Isle score per `-isle X` student: +10 if the seat is in the first or last column, else -10. | P0 | |
| FR-7 | Total Fitness Score = Front + Near By + Isle. Weighted Score = (F+N)*0.60 + (F+I)*0.10 + (N+I)*0.10 + F*0.04 + N*0.04 + I*0.02, with NO floor at 0. | P0 | D7, paper formula. |
| FR-8 | Selection `-random`: 100 picks with replacement from the current population. | P0 | |
| FR-9 | Selection `-queen`: the best individual of the CURRENT generation is paired with 50 randomly chosen others. | P0 | Fixes "initial best forever" (paper 4.3). |
| FR-10 | Selection `-plague` with `-killrate N` (percent): remove the N% weakest by weighted score, then fill the 100-slot mating pool by sampling the survivors, any survivor (including the last) eligible. No placeholder or blank individuals. | P0 | Fixes last-survivor exclusion, kill=100 crash, blank placeholders. |
| FR-11 | Selection `-beeplague`: apply plague (FR-10) then queen bee (FR-9) on the surviving population. | P1 | D8; promoted into this iteration; P1 because it is new relative to the code. Flag name `-beeplague` matches the paper's term. |
| FR-12 | Crossover `-pmx`: block-swap PMX with block size 4 (gene size), producing valid permutations. `-cx` (default): cycle crossover with the cycle start position chosen at random from the seeded RNG per mating pair (D18). Applied per pair with probability `-xoverrate`; otherwise parents pass through as copies. | P0 | D3, D9. Legacy hand-rolled PMX cascade is replaced by a correct PMX; legacy repair step not needed if offspring are valid by construction. |
| FR-13 | Inversion mutation: each individual mutates independently with probability `-mutrate`; two cut points chosen, the segment between them reversed, on a copy. Population stays exactly 100. | P0 | D10. Fixes at-most-once, in-place, 101-entry list. |
| FR-14 | Rate semantics are strict probabilities: a rate fires with probability exactly equal to the value; 0.0 means never, 1.0 always. Defaults: `-xoverrate` 0.9, `-mutrate` 0.1, `-killrate` 50. | P0 | Fixes inclusive compare, 0.0-becomes-default, killrate 0-becomes-50. |
| FR-15 | Run: 1 initial evaluation + 50 generations of 100. The loop scores, dumps, selects, crosses, mutates in a consistent, documented order. | P0 | |
| FR-16 | Reports: one file per scored population in the directory given by `-out DIR` (default `./out/`, created if missing; never the CWD). Names: `Generation5050.txt` (initial), `Generation0.txt` .. `Generation49.txt`: 51 files. Each file: a `Best Individual:` block, then 100 `Individual:` blocks, each with the five score lines and the legacy underscore separator. Weighted Score prints as the shortest round-trip decimal (with `.0` when integral). Each file is written atomically (temporary file in the output dir, then rename); on any write failure no partial report file is left and the run exits 1. Existing files with the same names are overwritten. | P0 | D4, D11. Every written individual is a valid permutation. |
| FR-17 | CLI keeps legacy flag names: `-frontrow X`, `-proximity X Y`, `-isle X` (all repeatable), `-random`, `-queen`, `-plague`, `-pmx`, `-cx`, `-xoverrate`, `-mutrate`, `-killrate`, `-h`. Added: `-strictprox`, `-beeplague`, `-seed N`, `-out DIR`. Switch values are consumed by their switch (no "Argument Not Recognized" echo for values). `-h`, `-help` and `--help` are equivalent; if any is present, help is printed, nothing runs, exit 0 (help wins over other errors). No arguments prints help, exit 0. Unknown tokens are errors naming the token (FR-25), exit 2. When no selection flag is given, the selection method is `-random`; when no crossover flag is given, it is `-cx`. | P0 | Fixes argv re-scan noise and first-argument-only `-h`. Conflict note: flag names kept, semantics corrected (section 9). |
| FR-18 | Help text lists every flag, states that random selection is the default selection and cycle crossover is the default crossover, and documents the added flags. | P0 | D3. |
| FR-19 | Input validation with a clear message to stderr and exit code 2: student labels outside the people set; rates outside [0,1]; killrate outside [0,99]; missing or non-numeric values; more than one selection flag or more than one crossover flag (D15); a label repeated within `-frontrow`; a label repeated within `-isle`; a `-proximity` pair repeated, where `X Y` and `Y X` are the same pair; `-proximity X X`; any of `-seed`, `-out`, `-xoverrate`, `-mutrate`, `-killrate`, `-strictprox` given more than once. Duplicates are never silently accepted or scored twice. A label may appear in different rule types (for example front row and a proximity pair). Lowercase labels are accepted and normalized to uppercase. Non-fatal notes go to stderr as `dsseating: note: <message>` with exit 0 for: `-killrate` without `-plague` or `-beeplague`; `-strictprox` with no `-proximity` rule; no rules at all. Success exits 0. | P0 | Fixes silent no-ops for unknown labels and legacy crashes. |
| FR-20 | `-seed N` makes a run deterministic. If omitted, seed from time. The seed used is always reported in the stdout summary (FR-24). One seeded RNG is injected into the engine (no per-call time-seeded RNGs). | P0 | Fixes correlated RNGs. |
| FR-21 | If no individual has a positive weighted score, the Best Individual block still names the actual best (highest weighted score, which may be negative), never `null`. | P0 | Follows from removing the floor; fixes "Best Individual: null". |
| FR-22 | Unit tests: fitness functions (each of FR-3..FR-7, both proximity modes), each selection, each crossover, mutation, rate semantics, report format, argv parsing and validation, determinism by seed, validity property tests, and a test on a non-5x4 layout. | P0 | D13. |
| FR-23 | Best-effort sample tests: re-score individuals parsed from the sample `Generation*.txt` files. Only the valid comparisons are asserted: Front Row score and Isle score given a rule set, Total = F+N+I, Weighted formula applied to the recorded F/N/I (where the recorded weighted is not floored at 0), and permutation validity. Near By comparisons are only asserted in default proximity mode and only if a rule set is inferred. If no rule set can be inferred, these tests are skipped and reported "unverified". | P1 | D13, section 6. |

| FR-24 | Stdout summary of a successful run contains, in this order: the seed used (whether given or time-derived), the best individual of the final generation with its five scores, and the output directory with the number of files written (51). Nothing else is printed to stdout on success (the earlier legacy "Argument Not Recognized" noise is gone). Exact wording and layout are UX's. | P0 | Closes the stdout contract at PRD level. |
| FR-25 | One error format. Every error is a single line on stderr: `dsseating: error: <message>`, where the message names the offending token, value, or file. Usage and validation errors exit 2; I/O failures and unexpected internal errors exit 1. No Go panic or stack trace reaches the user (internal errors are recovered and reported in this same format). | P0 | |

Priorities: P0 = MVP blocker, P1 = should have (still in this iteration).

## 5. Non-Functional Requirements

- Performance: default run (pop 100, 50 gens, 51 files) finishes well under 1 s; report writing is buffered.
- Reproducibility: with `-seed`, files and stdout are byte-identical across runs on the same Go version and OS.
- Portability: standard Go toolchain, no cgo, no third-party runtime dependencies; macOS and Linux.
- Maintainability: the engine is a package with no CLI, filesystem or global-state dependency; operators and fitness rules are pure functions given an injected RNG.
- Safety: the original Java folder is read-only input; the port never writes there. No Go panic reaches the user for bad input; errors are messages with exit code 2 (or 1 for I/O failures).

## 6. Scope

### In scope (this iteration)
FR-1..FR-25: Go engine library with generic seat layout, the CLI with legacy flag names and corrected semantics plus `-strictprox`, `-beeplague`, `-seed`, `-out`, 51 report files, and a unit-test suite.

### Out of scope / Future
- Web front end (layout editor, sharing, event-planner constraint types): a separate project that begins with the brainstorming skill; only the seat-layout seam is built here.
- Non-grid topologies (round tables) and `-rows/-cols/-gens/-pop` flags: engine config supports them, no CLI flags yet.
- Other constraint types (age, family, preferences): paper's wedding example; future.
- Varying PMX block size, "village idiot" anti-convergence, varying selection per generation: paper future work, deferred.
- Best-seating grid on stdout, JSON output: deferred.
- Reproducing Java random streams; Rust port; byte-exact Java number formatting.

### Which sample-file comparisons remain valid
The sample `Generation*.txt` files were generated by an unknown rule set (not the paper's: e.g. in the Generation49 best, F sits in an aisle column but Isle Score is -10, and the front-row sum is 54, which differs from what the paper's set gives). With bugs fixed:

| Comparison | Valid? |
|------------|--------|
| Each individual is a permutation of A-T | Yes |
| Total Fitness Score = Front + Near By + Isle | Yes |
| Front Row Score and Isle Score for an individual, given a rule set | Yes (formulas unchanged) |
| Weighted Score from recorded F/N/I | Yes, except where the recorded value was floored at 0 (the fix removes the floor) |
| Near By Score | Only in default proximity mode, only if the rule set is inferred; the lookup bugs may have affected recorded values, so mismatches there are not by themselves failures |
| Best/convergence trajectories, run-to-run values | No (random, different operators) |

## 7. Dependencies & Constraints

- Go 1.27.3 at `/opt/homebrew/bin/go`; no installs needed.
- Source of truth for behavior: the Java `DS_Seating.java` (read-only) and the design paper. The original development environment is gone.
- Deliverables live under `/Users/cgianelle/Projects/dsseating-port/`.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sample rule set cannot be inferred, so fidelity to old output can't be shown | High | Low | FR-23 is best-effort; fitness correctness is established by unit tests on hand-computed cases from the paper. |
| Default (legacy) proximity scoring still produces seatings with close pairs, as the paper observed | High | Med | Documented; `-strictprox` is the remedy; quality metric measured in both modes. |
| Layout seam over-engineered | Med | Low | Seam is just seats with row/column and a people list; no extra topology features. |
| Fixed operators change results relative to the 2003 runs | Certain | Low | Intended (D2); the paper's results are an informal reference only. |
| Flag semantics change breaks someone's old command lines | Low | Low | Names unchanged; only previously broken behavior changes; noted in help. |

Riskiest assumption: that the paper's described behavior (D2) is what the owner means by "correct" for every quirk. Validated by the owner reviewing this PRD and a first run.

## 9. Open Questions & Assumptions

- **Conflict noted:** "same flags and labels" versus "fix bugs". Resolution applied: names and labels unchanged; semantics corrected (0.0 rates mean never, killrate validated, values consumed, `-h` anywhere, bad input exits 2). Near By values differ from old output where lookup bugs mattered.
- **Closed OQ-1:** conflicting selection/crossover flags fail with exit 2 (D15).
- **Closed OQ-2:** negative Weighted Scores acceptable (D16).
- **Closed OQ-3:** only the strict-mode target remains, as a calibrated pass/fail check (D17).
- **Closed OQ-4:** CX start is random from the seeded RNG (D18).
- **Assumed (R):** the recommended defaults marked (R) in the revision delta are accepted unless the owner objects at Gate 1b.
- **Assumed:** report files use `\n` line endings; `-strictprox` and `-beeplague` are the final flag names.
- **Assumed:** Not-near rule sets of three students (Q, R, S) are entered as pairs (`-proximity Q R -proximity Q S -proximity R S`).
- **Assumed (unconfirmed):** the paper's front list includes R and the not-near set includes R, as printed; no conflict resolution needed.

Bug-fix traceability (legacy quirk to FR): row-5 coordinate copy-paste and stale coordinates (FR-4); weighted floor (FR-7, FR-21); mutation once/in place/101 entries (FR-13); inclusive rate compare, 0.0 and killrate-0 defaults (FR-14); plague last-survivor, kill=100 crash, blank placeholders (FR-10); queen bee stale best (FR-9); help claims PMX default (FR-18); argv re-scan, first-arg `-h` (FR-17); correlated time-seeded RNGs (FR-20); CWD pollution (FR-16); CX fixed start (FR-12); silent unknown labels (FR-19).

## 10. Release & Rollout

Single milestone: engine library + CLI + tests + README (the README states the web front end is a separate future project). Checkpoint: owner reviews a sample run's 51 files on the paper's rule set in default and `-strictprox` modes and reviews the strict-mode pass/fail result before the web project's brainstorming begins.
