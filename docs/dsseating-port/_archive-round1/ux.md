# UX: DSSeating Port (CLI surface)

**Status:** Draft
**Author:** Sally
**Last updated:** 2026-10-31
**Sources:** /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/prd.md

Owner decisions applied (override PRD defaults where they conflict): faithful port as-is; no GUI this iteration; legacy bugs preserved and deferred to a later iteration. The CLI and report mirror the legacy program. Only additions the port cannot work without (`-seed`, output dir, input validation) are new, and each is labeled.

## 1. Goal

A teacher-style operator types seating rules as legacy-style switches and gets (a) the legacy `GenerationN.txt` reports and (b) a readable best seating on stdout. A maintainer can diff Go output against legacy reports and trust the same flags behave the same way. Success is "my old command line still works and the report looks the same", not a better interface.

## 2. Recommended direction

One binary, `dsseating`, a single command, no subcommands, no interactive prompts, no color, no TTY detection. Flags are the legacy switches verbatim (single-dash, multi-word, repeatable, positional operands such as `-proximity X Y`), so they are parsed by a small hand-written legacy parser, not Go's `flag` package (which cannot do repeatable multi-operand switches or order-independent mixing). Reports are plain text files in the legacy block layout. Console output is plain, line-oriented, screen-reader friendly, and splits cleanly: results on stdout, diagnostics on stderr.

Alternative rejected: GNU-style `--long-flags` with cobra. It breaks "old command line still works" and adds a dependency, for no user value in a faithful port.

## 3. PRD review (UX lens)

| ID | Severity | Finding | Suggested change |
|----|----------|---------|------------------|
| UXR-1 | High | PRD section 9 OQ-3 defaults to FIXING bugs (b)-(g); owner decision is to PRESERVE them. FR-10 also says "port must never emit invalid output" and FR-3/OQ-2 assume default PMX. Direct conflict with "mirror legacy". | Re-baseline: OQ-3 = preserve all (a)-(h); document each as a named quirk with a test. Where a preserved bug could emit an invalid permutation or crash (mutation bounds (e), `-killrate 100` (f)), keep legacy selection/operator math but guard only the crash/invalid-output outcome, and record it as a known deviation. Needs PRD wording. |
| UXR-2 | High | OQ-2: default crossover. Faithful port means cycle crossover when no switch is given, but legacy help text says PMX is default. A user reading help will be misled. | Preserve behaviour (cycle). Help text (section 8) states the true default and notes the legacy help said otherwise. PRD should close OQ-2 as "cycle, preserve". |
| UXR-3 | Medium | OQ-4 (byte-for-byte number formatting) is a UX requirement, not an open detail: the report is the primary deliverable and diffed against samples. | Close as: labels and layout byte-identical; numbers follow the Java `Double.toString` look (section 8, Report). Parity harness (FR-16) should compare parsed numbers, not text, so formatting edge cases do not mask logic bugs. |
| UXR-4 | Medium | FR-15 validation contradicts "legacy silently misbehaves" being preserved. Silent misbehaviour on bad input is not a behaviour worth mirroring, and several cases (label outside A-T, missing operand) have no defined legacy result. | Keep FR-15 as a new, labeled safety addition limited to inputs where legacy behaviour is undefined or crashes. Keep legacy leniency for unrecognized args (warn, continue). See error table. |
| UXR-5 | Medium | FR-12 default output dir `./out/` and FR-13 `-seed` are new flags with no legacy counterpart, and FR-12 names the dir as "user-selectable" without a flag name. | Name it `-outdir DIR` (section 8). Add to FR-12 text. |
| UXR-6 | Medium | OQ-7: 50+ files per run is the legacy behaviour and the PRD default; it is also the biggest friction (clutters the CWD, reruns overwrite silently). | Keep per-generation files (faithful) but only into `-outdir`, and print the directory and file count on stdout. Overwrite is silent for `GenerationN.txt` names (legacy), but never outside `-outdir`. `-quiet` stays deferred. |
| UXR-7 | Low | FR-14 (P1) is the only human-friendly output and the task mission is "read the best seating chart", yet it is P1 behind P0 file dumps. | Treat FR-14 as in-scope for this CLI spec; it is cheap and is what the operator actually reads. Raise to P0 if possible. |
| UXR-8 | Low | FR-17 `-gens`/`-pop` are P2 but FR-11 says "configurable". | Specify `-gens N` and `-pop N` in help now (marked as extensions); implementation may land later. |
| UXR-9 | Low | Exit codes undefined except "non-zero". | Defined in section 8. |

## 4. Users and jobs

- **Primary:** operator (teacher-style) at a terminal. Job: state who must sit in front / apart / on the aisle, run, read the best chart. Likely not a Go developer; copy-pastes legacy command lines. `[ASSUMPTION]` no scripting beyond shell one-liners.
- **Secondary:** maintainer. Job: diff reports against legacy samples, reproduce runs by seed, script parity checks. Needs stable text layout, deterministic output, and meaningful exit codes.
- Constraints: no existing design system; the "existing pattern" being reused is the legacy switch syntax and `GenerationN.txt` block layout.

## 5. Key flow

Happy path:

1. Operator runs `dsseating -frontrow A -frontrow B -proximity D P -isle R -plague -pmx -xoverrate 0.85 -mutrate 0.05 -killrate 75`.
2. Parser accepts args in any order; defaults fill the rest.
3. Stdout prints the run header (seed, settings, rules).
4. GA runs; reports are written to `./out/`.
5. Stdout prints the best seating grid, its scores, and the output location.
6. Exit 0.

Recovery paths:

- No args or `-h`: print help to stdout, exit 0, write nothing (legacy `UI()`).
- Unrecognized arg: warning on stderr, continue (legacy), exit 0 at end. Summary line on stdout is unaffected.
- Invalid value or malformed switch: error on stderr naming the switch and the fix, usage hint, exit 2, nothing written.
- Cannot create or write output dir: error on stderr, exit 1. Nothing partial is advertised as success.
- Rerun with the printed seed: identical stdout (except nothing time-dependent is printed) and identical files.

## 6. Information architecture and navigation

Flat. Single entry point `dsseating [switches]`. Switch groups, in help order: Rules (`-frontrow`, `-proximity`, `-isle`), Selection (`-random`, `-queen`, `-plague`), Crossover (`-pmx`, `-cx`), Rates (`-xoverrate`, `-mutrate`, `-killrate`), Run (`-seed`, `-outdir`, `-gens`, `-pop`), Help (`-h`). No config file, no environment variables.

## 7. Screen inventory

There are no screens (no GUI this iteration). CLI surfaces:

| Surface | Purpose | Primary FR IDs |
|---------|---------|----------------|
| Help text (`-h` / no args) | Teach switches and defaults | FR-3 |
| Run header (stdout) | Echo effective settings and seed for reproducibility | FR-3, FR-13 |
| Best seating summary (stdout) | Human-readable result | FR-14, FR-4..7 |
| Generation report files | Legacy-format machine/diff-able output | FR-12 |
| Warnings and errors (stderr) | Input feedback | FR-3, FR-15 |
| Exit codes | Script contract | FR-15 |

## 8. Surface specifications

### 8.1 Synopsis and flags

```
dsseating [switches]
```

Switch parsing: single dash, case-sensitive, any order, repeatable where noted. A switch consumes the operands shown; operands never start with `-`. `[ASSUMPTION]` the legacy parser is case-sensitive and order-independent; confirm from `DS_Seating.java` in the build phase.

| Switch | Operands | Repeat | Default | Notes |
|--------|----------|--------|---------|-------|
| `-frontrow` | `X` | yes | none | Student wants front. Score row1 +10 ... row5 -10 (FR-4) |
| `-proximity` | `X Y` | yes | none | Pair; legacy formula preserved (FR-5) |
| `-isle` | `X` | yes | none | Aisle seat, columns 1 and 4 (FR-6). Spelling "isle" is legacy and kept |
| `-random` | | | yes | Random selection |
| `-queen` | | | | Queen bee selection |
| `-plague` | | | | Plague selection |
| `-pmx` | | | | Partially matched crossover |
| `-cx` | | | yes (actual) | Cycle crossover; this is what runs when neither is given |
| `-xoverrate` | `R` | no | 0.9 | 0..1 |
| `-mutrate` | `R` | no | 0.1 | 0..1 |
| `-killrate` | `N` | no | 50 | Plague only; 1..90 |
| `-seed` | `N` | no | time | New. Unsigned 64-bit integer |
| `-outdir` | `DIR` | no | `./out` | New. Created if missing |
| `-gens` | `N` | no | 50 | New extension (FR-17). 1..10000 |
| `-pop` | `N` | no | 100 | New extension (FR-17). 2..10000, even `[ASSUMPTION]` since crossover works on pairs |
| `-h` | | | | Help, exit 0 |

Conflicts: giving two selection switches or both `-pmx` and `-cx` is accepted; last one wins (legacy-style, `[ASSUMPTION]`), with a stderr note `note: -queen overrides -plague`. This is cheaper than rejecting and keeps old command lines working.

### 8.2 Help text (stdout, exit 0)

```
DSSeating - genetic-algorithm classroom seating (20 students A-T, 5 rows x 4 seats)

Usage: dsseating [switches]

Rules (repeatable):
  -frontrow X        student X should sit near the front
  -proximity X Y     students X and Y: see scoring note below
  -isle X            student X should sit in an outside aisle seat

Selection (default -random):
  -random            pick the next generation at random
  -queen             pair the best individual with random mates
  -plague            drop the weakest -killrate percent, sample the rest

Crossover (default -cx):
  -pmx               partially matched crossover
  -cx                cycle crossover
  (Legacy help claimed PMX was the default; the program actually used cycle.)

Rates:
  -xoverrate R       crossover probability, 0 to 1      (default 0.9)
  -mutrate R         mutation probability, 0 to 1       (default 0.1)
  -killrate N        percent culled by -plague, 1 to 90 (default 50)

Run:
  -seed N            fixed random seed (default: from clock, printed)
  -outdir DIR        where GenerationN.txt reports go   (default ./out)
  -gens N            generations to run                 (default 50)
  -pop N             population size                    (default 100)
  -h                 show this help

Students are the letters A to T. Rows 1-5 run front to back; columns 1 and 4
are the aisle seats.

Scoring note: -proximity keeps the original program's formula, which scores a
pair higher the farther apart they sit and lower the closer they sit.

Example:
  dsseating -frontrow A -proximity D P -isle R -plague -pmx -killrate 75 -seed 42
```

### 8.3 Run header (stdout)

```
Seed: 42
Selection: plague   Crossover: pmx   xoverrate: 0.85   mutrate: 0.05   killrate: 75
Population: 100   Generations: 50
Rules: frontrow A; proximity D-P; isle R
Writing reports to ./out/
```

Rules for the header: `Seed:` always first (reproducibility, FR-13). Settings are the effective values after defaults, so "what ran" is never ambiguous. `killrate` shown only with plague. Rules line says `Rules: none` when empty. Seed is printed whether supplied or generated.

### 8.4 Best seating summary (stdout)

```
Best seating (generation 50)

           Col 1(aisle)  Col 2  Col 3  Col 4(aisle)
Row 1 front     A          F      K      B
Row 2           ...
Row 5 back      ...

Row 1: A F K B
Row 2: ...

Front row score: 47.0
Proximity score: 30.0
Isle score: 20.0
Weighted fitness: 119.0

Wrote 51 reports to ./out/ (Generation0.txt .. Generation50.txt)
```

Rules: the grid has text row and column labels, plus a plain `Row N: ...` list repeated below so a screen reader or `grep` has a non-tabular form. No box-drawing characters, no color. Score labels reuse the report labels. `[ASSUMPTION]` the initial evaluation is `Generation0.txt` and the files number 0..50 (FR-11 says 1 initial evaluation + 50 generations); confirm numbering from the sample files. Report counts on the last line are computed, not hardcoded.

### 8.5 Generation report file (FR-12)

Per file `GenerationN.txt` in `-outdir`: one Best Individual block, then one block per individual (default 100), in the legacy layout. Block shape (labels and spacing to be copied verbatim from the sample `Generation*.txt` files; the fixture is the spec):

```
Best Individual
Individual: ABCDEFGHIJKLMNOPQRST
Front Row Score: 47.0
<proximity label as in samples>: ...
<isle label as in samples>: ...
<weighted label as in samples>: ...
___
Individual: ...
...
```

Number format: Java `Double.toString` look. At least one decimal digit (`47.0`), shortest representation that round-trips (`49.599999999999994` stays as is), plain decimal notation in the range seen in practice. Go `strconv.FormatFloat(v, 'f', -1, 64)` plus a forced `.0` for integral values reproduces this for realistic scores; scientific notation is not expected. `[ASSUMPTION]` score range never needs exponent form. Line endings `\n`. UTF-8 / ASCII only. Files are written buffered and are flushed and closed before the final stdout summary.

### 8.6 Errors, warnings, exit codes

Diagnostics go to stderr, one per line, prefixed `dsseating:`. Each says what was wrong, which switch, and the valid form. Never a stack trace.

| Condition | Class | Message (example) | Exit |
|-----------|-------|-------------------|------|
| `-h` or no args | help | help text on stdout | 0 |
| Unrecognized arg | warning, continue (legacy) | `dsseating: ignoring unrecognized argument "-foo" (try -h)` | 0 |
| Switch missing operand | error | `dsseating: -proximity needs two students, e.g. -proximity D P` | 2 |
| Student not A-T (or not one letter) | error | `dsseating: "Z" is not a student; use a letter from A to T` | 2 |
| `-proximity X X` | error `[ASSUMPTION]` | `dsseating: -proximity needs two different students` | 2 |
| Rate not a number or outside range | error | `dsseating: -xoverrate must be a number from 0 to 1, got "1.5"` | 2 |
| `-killrate` outside 1-90 | error | `dsseating: -killrate must be a whole number from 1 to 90, got 100` | 2 |
| Bad `-seed`, `-gens`, `-pop` | error | `dsseating: -seed must be a non-negative whole number` | 2 |
| Conflicting selection or crossover switches | note, continue | `dsseating: note: -queen overrides -plague` | 0 |
| `-killrate` without `-plague` | note, continue | `dsseating: note: -killrate has no effect without -plague` | 0 |
| Cannot create or write `-outdir` | runtime error | `dsseating: cannot write to ./out: permission denied` | 1 |
| Internal invariant failure (non-permutation) | runtime error | `dsseating: internal error: invalid seating produced (please report, seed 42)` | 1 |

All validation happens before any file is written, so exit 2 never leaves partial output. Exit 1 after partial file writes names the last good generation. Because validation precedes the run, a failing run is quick and cheap to retry. Multiple validation errors are all reported (up to the first 5), not just the first, then exit 2.

### 8.7 Interactions

- Run is non-interactive: no prompts, no confirmations. Overwriting `GenerationN.txt` inside `-outdir` is silent (legacy writes into CWD likewise). The tool never deletes files and never writes outside `-outdir`.
- Ctrl-C: exit 130, no partial-success message; any already-written reports remain. `[ASSUMPTION]` Go default signal behavior is acceptable.
- Output is non-streaming for the default run (target < 100 ms), so no progress indicator. If `-gens`/`-pop` push runtime beyond ~1 s, print a single `Generation k/N` line to stderr only when stderr is a terminal; deferred, not MVP.

## 9. States and edge cases

- **Empty rules** (only options, or `-seed 1`): run proceeds, all scores 0, weighted 0; header says `Rules: none`; summary still prints a grid. One stderr note: `dsseating: note: no rules given; every seating scores 0`. No-args is the exception and prints help instead (legacy).
- **Repeated rule**, e.g. `-frontrow A -frontrow A`: legacy behaviour is to score it twice; preserved, no warning `[ASSUMPTION]`.
- **Weighted fitness floors at 0** (legacy, preserved): many individuals tie at 0.0 and reports show `0.0`; the summary shows the true unweighted component scores alongside, so the operator can see a negative component under a 0 weighted result.
- **Output dir exists with old reports** from a longer prior run (`-gens 80` then default): stale `Generation51..80.txt` remain. The summary lists the exact range written, so staleness is visible; tool does not delete.
- **Same seed, different args**: different results; header echoes effective settings so runs are comparable.
- **Preserved-bug visibility**: where legacy quirks are user-visible (proximity reward, cycle default, floor at 0, plague last-survivor bias), the help text and this spec name them; they are not hidden by wording.
- **Long output**: the summary is under 25 lines; reports are the bulk output and go to files, never stdout.
- **Permission/destructive**: only destructive act is overwriting same-named reports inside `-outdir`; judged acceptable and documented in `-outdir` help.
- **Windows / non-UTF-8 terminals**: output is ASCII-only, no ANSI codes.

## 10. Accessibility

WCAG 2.2 AA applied to a terminal tool:

- No information conveyed by color or position alone; the grid is duplicated as `Row N:` text lines (1.3.1, 1.4.1).
- Plain ASCII, no box-drawing or emoji, no cursor movement or progress bars, so screen readers and braille displays read it linearly (1.3.2).
- Error messages name the switch, the problem, and a valid example (3.3.1, 3.3.3).
- Help is reachable with `-h` and with no arguments, and prints entirely to stdout so it can be piped to a pager (3.3.5 analogue).
- Lines stay under 80 columns, so no horizontal scrolling or wrap-dependent alignment, except the Individual strings in reports, which are 20 characters.
- Honors `NO_COLOR` trivially (never emits color).
- No time-limited interaction.

## 11. Open questions and assumptions

- **Open:** exact legacy strings: unrecognized-arg message, report score labels, `Best Individual` header text, generation numbering (0-based?). Take from sample `Generation*.txt` files and legacy source during build; the fixtures override the examples in this spec.
- **Open (PRD):** UXR-1 and UXR-2: preserve-vs-fix and default crossover need to be reflected in the PRD (owner decision already given; PRD text is stale).
- **Open (PRD):** whether FR-15 validation is acceptable alongside "mirror legacy" (UXR-4). Spec assumes yes, limited to undefined or crashing inputs.
- **Assumed** `[ASSUMPTION]`: parser is case-sensitive and order-independent; last conflicting selection/crossover switch wins; `-proximity X X` rejected; repeated rules score twice; initial population report is `Generation0.txt`; `-pop` must be even; Ctrl-C exit 130.
- **Assumed** `[ASSUMPTION]`: exit codes 0/1/2 (0 success or help, 1 runtime/IO/internal, 2 usage), the Unix convention; legacy had no meaningful codes.
- **Assumed** `[ASSUMPTION]`: no research on operator habits was done; "operator copy-pastes legacy command lines" is inferred from the PRD.

## 12. Implementation notes

- No UI component reuse; no design system exists. A small `args` package with a legacy-style parser (table of switch name to operand count, repeatable flag) producing a config struct plus a list of diagnostics (warning/note/error) keeps parsing pure and unit-testable; main only prints diagnostics and chooses the exit code.
- Do not use Go `flag` for the legacy switches (no repeatable multi-operand support, double-dash and `=` conventions differ). `os.Args` plus a hand parser is simpler.
- Formatting (score text, run header, grid, report blocks) belongs in one `report` package of pure functions returning strings or writing to `io.Writer`, so golden-file tests can pin them against the sample reports and against this spec's examples.
- Stdout/stderr and the exit code are injected (`io.Writer`, return int from `run(args, stdout, stderr) int`) so CLI behaviour, including every row of the error table, is table-testable without subprocesses.
- Test hooks: seed determinism (10 identical runs, FR-13), help text snapshot, one test per error row, golden report diff.
- Feasibility: all of this is stdlib-only and fits the < 100 ms budget; writing 51 files is the dominant cost, so use buffered writers per file.
