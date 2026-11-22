# PRD: DSSeating Port (Java GA to Go)

**Status:** Draft (revision 1, awaiting Gate 1b)
**Author:** product-manager agent
**Last updated:** 2026-10-31
**Slug:** dsseating-port

## Revision delta (round 1, for owner review at Gate 1b)

Binding owner decisions applied: faithful port as-is; no GUI this iteration; legacy bugs PRESERVED now and fixed in the next iteration; Go 1.27.3 is installed. FR IDs are unchanged; no FR was renumbered or deleted.

| # | Change | Where | Closes |
|---|--------|-------|--------|
| 1 | Added section 2a "Iteration decision": faithful port, preserve bugs, fix next iteration, plus a per-FR in/out table. | 2a, 4 | B-3, W-3, W-7 |
| 2 | FR-3 rewritten: legacy argv semantics preserved (value tokens re-scanned and reported, `-h` only as first arg, no-arg prints help, stdout stream, missing/non-numeric value is a typed error exit 1). Rate semantics stated as preserved legacy behavior. Repeated selection/crossover switches follow the legacy source. | FR-3 | B-4, W-2, W-4 |
| 3 | Help text: legacy `UI()` text verbatim plus exactly ONE appended note line. Rewritten help is out of scope. | FR-3a (new sub-requirement) | B-5 |
| 4 | Output directory flag named `-out` (default `./out/`). Only two flags are added to the legacy set this iteration: `-seed N` and `-out DIR`. | FR-12, FR-13 | B-2 |
| 5 | Generation file naming and numbering defined: initial dump `Generation5050.txt`, generations `Generation0.txt`..`Generation49.txt`, 51 files per default run. | FR-11, FR-12 | B-1 |
| 6 | FR-10 "never emit invalid output" restated: inversion always yields a valid permutation; every written individual is a valid permutation; crash-class cases become a typed error with exit 1, never a silent change. | FR-10, FR-19 (new) | B-7, B-6 (part) |
| 7 | New FR-19: crash-class and null-best behavior (null best prints `Best Individual: null`; crash = stderr message naming the legacy behavior, exit 1). Exit codes are only 0 and 1. | FR-19 | B-6, C-6 |
| 8 | FR-14 (best-seating grid), FR-15 (validation), FR-17 (`-gens`/`-pop`), FR-18 (JSON) explicitly OUT of this iteration; FR-16 (parity harness) IN. | 2a, 4 | W-3, W-7, C-3, C-8, C-10 |
| 9 | OQ-2 closed: cycle crossover is the real default; legacy help claiming PMX is wrong. OQ-3 flipped from "fix" to "preserve" for every item. OQ-4 sub-item (e) corrected (mutation bounds cannot overflow). OQ-1 closed (Go). OQ-6 closed (no dead operators). OQ-7 closed. OQ-5 stays open. | 9 | B-7 |
| 10 | Section 6: `VerifyValidness` removed from dead code (it is live: both crossovers call it). Section 7: Go 1.27.3 installed. | 6, 7 | B-7 |
| 11 | Terminology note: Go identifiers say "Aisle"; flag and report label keep legacy spelling "Isle". Report labels (`Front Row Score`, `Near By Score`, `Isle Score`, `Total Fitness Score`, `Weighted Score`) are the project's ubiquitous language. | 3a, FR-12 | L-2, W-1 |
| 12 | FR-16 kept; OQ-5 (sample rule set) remains an open owner confirmation, and the parity metric is reported as "unverified" if the rule set cannot be inferred. | FR-16, 9 | W-5 |

## 1. Problem Statement

DSSeating (2003, SWENG584 grad project, Java) uses a custom genetic algorithm (GA) to arrange 20 students (A-T) in a 5-row x 4-seat classroom under a teacher's rules: some students must sit in the front, some must not sit near each other, some must take an outside-aisle seat. The original is a single ~2200-line class with copy-pasted per-row logic, a JBuilder-era toolchain, time-seeded non-reproducible RNG, a hardcoded 100-individual / 50-generation run, and 51 report files (`Generation*.txt`) written to the CWD. It cannot be tested reliably, and several behaviors are latent bugs.

The owner wants a clean, fast, testable port in a separate folder (`/Users/cgianelle/Projects/dsseating-port/`), leaving the original untouched. This iteration is a **faithful port**: observable behavior, including the bugs, is preserved. Fixing the bugs is the next iteration.

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Behavioral fidelity of the GA | Fitness functions (front-row, proximity, aisle, weighted) match the Java on a fixed corpus of chromosomes | 100% match on corpus extracted from the sample `Generation*.txt` files (all scored individuals); reported "unverified" if OQ-5 cannot be resolved |
| Legacy bug preservation | Each preserved legacy behavior (section 9, OQ-3) has a test pinning it | 100% of listed items pinned; each isolated so the next iteration can flip it |
| Reproducible runs | Same seed + same args yield byte-identical output | 100% across 10 repeated runs |
| Efficiency | Wall time for a default run (pop 100, 50 gens) | < 100 ms (Java baseline to be measured, TBD) |
| Maintainability | Single-binary build, unit tests on every operator | `go test ./...` green; tests cover each selection, crossover, mutation and fitness function |
| Solution quality parity | Best weighted score after 50 gens, same rules/operators, averaged over 30 seeds | Not worse than Java sample outputs' best (e.g. ~119 weighted for the sample rule set; TBD baseline). Expected to hold because bugs are preserved. |

Non-goals this iteration: fixing legacy bugs, new GA features, a GUI, other class sizes or layouts, modifying the Java project, new CLI features beyond `-seed` and `-out`.

### 2a. Iteration decision (owner, authoritative)

- Faithful port as-is. No GUI. Legacy bugs preserved now, fixed in the next iteration.
- Anything that is a new feature rather than legacy behavior is deferred unless required for crash-safety (a legacy crash must surface as a clean typed error, not a Go panic).
- Only `-seed N` and `-out DIR` are added to the legacy switch set, because FR-12 (no CWD pollution) and FR-13 (reproducibility) require them.

| FR | Status this iteration |
|----|-----------------------|
| FR-1..FR-13 | IN |
| FR-14 best-seating grid on stdout | OUT (deferred; presentation only) |
| FR-15 input validation, exit code 2 | OUT (deferred; legacy crash cases still exit 1 via FR-19) |
| FR-16 parity harness | IN (blocked on OQ-5 for full verification) |
| FR-17 `-gens` / `-pop` | OUT (deferred; no flag, not in help; internal constants only) |
| FR-18 JSON output | OUT (deferred) |
| FR-19 crash-class and null-best behavior | IN (new, P0) |

## 3. Users & Use Cases

- **Primary user:** the project owner / a teacher-style operator running the CLI with seating rules and reading the generation report files.
- **Secondary user:** a developer maintaining/extending the port (needs tests and clear parity with the legacy behavior; the next iteration flips preserved bugs).

Today: run `DSSeating.jar`/`.exe` with CLI switches (`-frontrow A -proximity D P -isle R -plague -pmx -xoverrate 0.85 -mutrate 0.05 -killrate 75`); results land in `GenerationN.txt` files. The "UI()" is only a help text printed for no-args or `-h`; there is no Swing GUI.

### 3a. Terminology

Report labels keep legacy spelling and are the project vocabulary: `Front Row Score`, `Near By Score`, `Isle Score`, `Total Fitness Score` (sum of three scores), `Weighted Score` (FR-7). The CLI flag is `-isle`. Code identifiers use "Aisle". Docs use these terms, not "Proximity score" or "Weighted fitness", when referring to printed labels.

## 4. Functional Requirements

Legacy behavior documented from `DS_Seating.java` (see section 9 for quirks). "Preserve" means the Go port reproduces the legacy behavior, bug included.

| ID | Requirement | Priority | Iteration | Notes |
|----|-------------|----------|-----------|-------|
| FR-1 | Model a class of 20 students labeled A-T seated in 5 rows of 4; a chromosome is a permutation of A-T, rows are slices [0:4],[4:8],[8:12],[12:16],[16:20]. | P0 | IN | |
| FR-2 | Generate an initial population of 100 random valid permutations (no duplicates/missing letters). | P0 | IN | |
| FR-3 | Accept the legacy CLI switches: `-frontrow X` (repeatable), `-proximity X Y` (repeatable), `-isle X` (repeatable), `-random`/`-queen`/`-plague`, `-pmx`/`-cx`, `-xoverrate`, `-mutrate`, `-killrate`, `-h`, plus the two added flags `-seed N` and `-out DIR`. Argument semantics are legacy behavior, preserved: (a) switch values are not consumed by the scanner; each value token is re-scanned and prints `<token>: Argument Not Recognized!` to stdout; (b) `-h` is honored only as the first argument; no arguments prints the help text; both exit 0; (c) a missing value for a value-taking switch, or a non-numeric number, is a crash-class case (FR-19); (d) defaults: random selection, cycle crossover, xover 0.9, mut 0.1, kill 50; (e) when several selection switches or several crossover switches are given, behavior follows the legacy source (architecture to cite the lines); (f) any crossover value other than `-pmx` runs cycle crossover. | P0 | IN | Resolves OQ-2 (cycle is the real default). Legacy help text claims PMX is default; that claim is wrong. `-seed` and `-out` are new, exempt from legacy re-scan noise only in that their values are consumed (they are not legacy tokens); architecture decides whether their value tokens are also echoed as unrecognized (default: consumed, not echoed). |
| FR-3a | Help text printed for `-h` / no args is the legacy `UI()` text verbatim, with exactly ONE appended note line (after the legacy text) that states the code default crossover is cycle and documents `-seed N` and `-out DIR`. No rewritten help. | P0 | IN | Single permitted addition. Architecture previously placed the note next to the PMX line; this PRD fixes it as one line appended at the end and lets architecture choose the exact wording. |
| FR-3b | Rate semantics are legacy behavior and preserved: crossover and mutation fire when `Intn(100) <= int(rate*100)` (inclusive: 0.9 acts as 91%, 0.1 as 11%); a rate argument of exactly 0.0 silently becomes the default (0.9 / 0.1); `-killrate 0` becomes 50 at selection time. These are not corrected or warned about this iteration. | P0 | IN | Test-pinned. Next iteration fixes. |
| FR-4 | Front-row score per `-frontrow` student: row1 +10, row2 +7, row3 0, row4 -7, row5 -10. | P0 | IN | |
| FR-5 | Proximity score per `-proximity X Y` pair: d = (\|dx\|+\|dy\|)/2 (float32); if d > 1 then +10*d else -10*d, added to the int score with truncation. Preserves legacy formula (rewards distance, penalizes closeness) and the legacy coordinate bugs (row-5 Y x-coordinate copy-paste; unmatched students keep the previous pair's stale coordinates). | P0 | IN | Preserve. Not a fix target this iteration. |
| FR-6 | Aisle score per `-isle` student: +10 if seat column is 0 or 3, else -10. Labels outside A-T silently score nothing. | P0 | IN | |
| FR-7 | Total Fitness Score = sum of the three scores; Weighted Score = (F+N)*0.60 + (F+I)*0.10 + (N+I)*0.10 + F*0.04 + N*0.04 + I*0.02, floored at 0 (so all poor individuals tie at 0.0; preserved). | P0 | IN | |
| FR-8 | Selection methods: random (100 picks with replacement), queen bee (best individual of the INITIAL population, never updated, paired with 50 random mates), plague (rank by weighted fitness, drop `killrate` weakest, sample 100 from survivors; sampling excludes the last survivor; `-killrate 100` is a crash-class case). All quirks preserved. | P0 | IN | Preserve OQ-3 items (f), (g). |
| FR-9 | Crossover methods: PMX (legacy hand-rolled cascade, not textbook PMX) and cycle crossover; both pass through the legacy `VerifyValidness` repair step so offspring are valid permutations. Applied per pair with probability per FR-3b, else parents pass through (same object, not a copy). | P0 | IN | |
| FR-10 | Inversion mutation: at most one mutation per generation, on a uniformly random individual, with probability per FR-3b. The inversion always yields a valid permutation. The individual is edited in place (shared references see the change) and then inserted at its index, so the list reaches 101 entries and only the first 100 are scored and dumped. All of this is preserved legacy behavior. | P0 | IN | Legacy bounds cannot overflow (OQ-3e corrected). The "must never emit invalid output" wording is superseded by FR-19. |
| FR-11 | Run 1 initial evaluation + 50 generations of population 100. Generation numbering: the initial scored population is labeled 5050; the 50 loop generations are labeled 0..49 (0-based loop index). | P0 | IN | `-gens` / `-pop` are out (FR-17). |
| FR-12 | Output: write one report file per scored population in the legacy text format to the directory given by `-out DIR` (default `./out/`, created if missing; never the CWD). File names: `Generation5050.txt` for the initial population, `Generation0.txt` .. `Generation49.txt` for the generations: 51 files per default run. Each file: a Best Individual block (Front Row Score, Near By Score, Isle Score, Total Fitness Score, Weighted Score) then 100 `Individual:` blocks with the same five score lines, separated by the legacy underscore line. Weighted Score is printed Java-style (e.g. `122.0`, `49.599999999999994`). | P0 | IN | `\n` line endings assumed (OQ-4). |
| FR-13 | `-seed N` flag for deterministic runs; if omitted, seed from time and print the seed used to stdout. | P0 | IN | Replaces the legacy per-call time-seeded RNGs. Java random streams are not reproduced. |
| FR-14 | Print final best seating as a 5x4 grid plus its scores to stdout. | P1 | OUT (deferred) | New feature. Stdout this iteration carries only the seed line (FR-13), legacy `Argument Not Recognized!` messages and help text. |
| FR-15 | Validate inputs: student labels in A-T, xover/mut rates in [0,1], killrate 1-90, exit code 2 with a clear message. | P1 | OUT (deferred) | Legacy silently misbehaves and that is preserved. Only crash-class cases are handled, via FR-19, exit 1. |
| FR-16 | Parity test harness: re-score every individual in the sample `Generation*.txt` files with the Go fitness code and compare parsed numbers to the recorded scores. Uses the rule set inferred by the implementer and confirmed by the owner (OQ-5). | P1 | IN | If the rule set cannot be inferred, the fitness-parity metric is reported "unverified", not "passed". |
| FR-17 | `-gens`, `-pop` flags to override 50/100. | P2 | OUT (deferred) | Not parsed, not in help. |
| FR-18 | JSON output option. | P2 | OUT (deferred) | |
| FR-19 | Crash-class and null-best behavior. (a) Wherever the Java throws or would fail (missing switch value, non-numeric number, `nextInt` with non-positive bound in plague, a blank placeholder individual reaching a later stage, any invalid permutation detected by the engine), the Go port stops with a typed error: message to stderr that names the legacy behavior, exit code 1, no Go panic, no silent substitution of a "fixed" value. Report files already written stay on disk; no further files are written. (b) If every Weighted Score is 0, the Best Individual block prints `Best Individual: null` with zero scores (legacy), and the run still exits 0. (c) Exit codes are only 0 and 1. (d) Every individual written to a report file is a valid permutation of A-T. | P0 | IN | This is how "never emit invalid output" coexists with preserve-bugs: the port never writes an invalid chromosome and never silently changes legacy behavior; where legacy crashes, the port exits 1 cleanly. Which common rule sets reach a crash (notably plague with many zero-weighted individuals) is to be verified by architecture reading the source; see section 9. |

## 5. Non-Functional Requirements

- Performance: default run < 100 ms on the dev machine; file output not the bottleneck (write buffered).
- Reproducibility: with `-seed`, output (files and stdout) is deterministic across runs on the same Go version/OS.
- Portability: builds with the standard Go toolchain (1.27.3 installed) on macOS/Linux, no cgo, no third-party runtime dependencies.
- Testability: fitness and operators are pure functions that accept an injected RNG; every preserved legacy behavior has a pinning test and is isolated so the next iteration can flip it.
- Safety: original Java directory is read-only input; port never writes into it.

## 6. Scope

### In scope (this iteration)
FR-1 through FR-13, FR-16 and FR-19: a Go CLI faithful to the legacy rules, operators, quirks and report format, plus seeded determinism, `-seed`/`-out`, and a unit test suite.

### Out of scope / Future (next iteration or later)
- Fixing any legacy bug (all of OQ-3): next iteration.
- FR-14 (best-seating grid), FR-15 (validation, exit 2), FR-17 (`-gens`/`-pop`), FR-18 (JSON), a rewritten help text, `-quiet`.
- GUI of any kind: original has none (console help only).
- Variable class size/layout: legacy is hardcoded; defer.
- Bug-compatible reproduction of Java's time-seeded random streams: impossible and undesirable; parity is defined on fitness functions, operator validity and preserved behaviors, not on random streams.
- Unused legacy code: FPRSelection, BestFitCrossover, FirstFitCrossover (dead/commented paths). Note: `VerifyValidness` is NOT dead; both crossovers call it, and it is ported (FR-9).
- Rust version.

## 7. Dependencies & Constraints

- Go 1.27.3 is installed (`/opt/homebrew/bin/go`, darwin/arm64). No toolchain install step is needed.
- Source of truth: `/Users/cgianelle/Projects/DSSeating_10_10_03/src/dsseating/DS_Seating.java`, design PDF `SWENG584_GA_ClassRoomDistribution_V0003.pdf` (not read: no PDF text tool; the Java source was used instead), and sample `Generation*.txt` outputs.
- Original folder must remain unmodified.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Preserving legacy bugs makes some runs crash (e.g. plague selection) | Med | Med | FR-19 typed error naming the legacy behavior; documented; fixed next iteration |
| Sample outputs don't record the rules used, so parity corpus cannot be fully verified | Med | Med | Implementer infers rules (OQ-5); owner confirms; otherwise the metric is reported unverified |
| Hand-rolled PMX and aliasing semantics ported subtly wrong | Med | Med | Line-faithful port, validity property tests, pin tests per preserved behavior |
| Quality metric missed | Low | Low | Bugs preserved, so parity is expected; compare best-score distribution over 30 seeds |

Riskiest assumption: that a single rule set explains all sample files (OQ-5).

## 9. Open Questions & Assumptions

Closed:
- **OQ-1 (closed): Go.** Owner decision.
- **OQ-2 (closed): cycle crossover is the real default** (no switch, `-cx`, or any value other than `-pmx`). The legacy help text claiming PMX is default is wrong; the port keeps the code behavior and adds one note line (FR-3a).
- **OQ-3 (closed, flipped to PRESERVE).** Every item below is preserved this iteration, isolated and test-pinned, and fixed in the next iteration:
  - (a) Proximity formula rewards distance, penalizes closeness, with the d>1 discontinuity (FR-5).
  - (b) Row-5 branch for student Y assigns the x-coordinate to X's x variable (FR-5).
  - (c) A student not found in any row keeps the previous pair's stale coordinates (FR-5).
  - (d) Mutation fires at most once per generation, edits the individual in place, and inserts it (list reaches 101; only first 100 scored/dumped) (FR-10).
  - (e) Corrected: mutation bounds cannot exceed the string length (start 1..4, end 2..15 with adjustment); inversion is always a valid permutation. No bounds bug to preserve or fix.
  - (f) Plague selection never picks the last survivor; killrate 100 crashes; individuals scoring 0 can be replaced by a blank placeholder that later crashes (FR-8, FR-19).
  - (g) Queen bee uses the initial population's best, never updated (FR-8).
  - (h) Weighted score floors at 0, ties at 0.0 (FR-7).
  - (i) Rate semantics: inclusive compare, 0.0 becomes default, killrate 0 becomes 50 (FR-3b).
  - (j) Argv re-scan noise and `-h` only as first arg (FR-3).
- **OQ-6 (closed):** no dead-code operators (BestFit, FirstFit, FPR).
- **OQ-7 (closed):** keep one file per scored population in the output dir; `-quiet` deferred.
- **Assumed [DEFAULT]: deterministic `-seed`;** parity defined by fitness equality and operator validity, not RNG streams. Uniform `IntN(100)` replaces Java's modulo-biased draw.
- **Assumed [DEFAULT]: CLI replaces everything.** No Swing GUI exists.

Open:
- **OQ-4:** Is the report format required byte-for-byte (line endings, Java double printing)? Assumed: same labels/layout, `\n` endings, shortest round-trip decimal with `.0` when integral; parity harness compares parsed numbers. Owner to confirm.
- **OQ-5:** Which rule set generated the sample `Generation*.txt` files? Needed for FR-16. Implementer infers; owner confirms.
- **OQ-8 (new, assumption):** Under common rule sets (many zero-weighted individuals), plague selection may hit the blank-placeholder crash and exit 1 (FR-19). Reachability is unverified. Architecture to confirm by reading the source; if plague is unusable in practice, owner to be told before build, though the decision stays "preserve".
- **OQ-9 (new, assumption):** `-seed` and `-out` value tokens are consumed by the port and not echoed as `Argument Not Recognized!`. Architecture to confirm in the argv design.

## 10. Release & Rollout

Single milestone: faithful port (FR-1..13, FR-16, FR-19) with tests and README. Checkpoint: owner reviews OQ-4, OQ-5 and OQ-8 answers and a sample run's report files against the Java samples before the next iteration (legacy bug fixes and the deferred P1/P2 items) begins.
