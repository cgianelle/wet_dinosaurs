# Check report: DSSeating Port (Java GA to Go)

**Status:** FAIL
**Last updated:** 2026-10-31
**Inputs expected:** 3 (`prd.md`, `ux.md`, `architecture.md`)
**Inputs received:** 3
**Sources:**
- PRD: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/prd.md
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/ux.md
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/architecture.md

Owner decision applied (from the invoking chat, not a spec file): faithful port, no GUI, legacy bugs preserved this iteration, Go 1.27.3 installed. UX and architecture both state the same decision. The PRD text does not.

## Fan-in

- [x] `prd.md` exists and is non-empty
- [x] `ux.md` exists and is non-empty
- [x] `architecture.md` exists and is non-empty

## Verdict

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 7 | 7 | 4 |

**FAIL.** `build-package.md` not written.

## 1. Coverage

| FR / NFR | Priority | UX | Architecture | Status |
|----------|----------|----|--------------|--------|
| FR-1 | P0 | n/a (no user surface; grid in 8.4) | AD-3, section 8 layout constants | ok |
| FR-2 | P0 | n/a | AD-9 step 1 | ok |
| FR-3 | P0 | 8.1, 8.2, 8.6 | Q-1, Q-4, Q-11, AD-7 | gap: UX and arch disagree (B-3, B-4, B-5) |
| FR-4 | P0 | 8.1 | AD-5 | ok |
| FR-5 | P0 | 8.1, help note | Q-2, Q-3, AD-5 | ok |
| FR-6 | P0 | 8.1 | AD-5 | ok |
| FR-7 | P0 | 9 (floor) | AD-5, Q-9 | ok |
| FR-8 | P0 | 8.1 | Q-7, Q-8, AD-9 | ok |
| FR-9 | P0 | 8.1 | Q-1, Q-13, AD-6 | ok |
| FR-10 | P0 | n/a | Q-5, Q-6 | ok in arch; PRD wording stale (B-7) |
| FR-11 | P0 | 8.4 | AD-9, Q-12 | gap: numbering conflict (B-1) |
| FR-12 | P0 | 8.5 | AD-8, Q-10, Q-12 | gap: dir flag and file names conflict (B-1, B-2) |
| FR-13 | P0 | 8.1, 8.3 | AD-4 | ok |
| FR-14 | P1 | in scope | "deferred" (14) yet wired in AD-9 | warning W-3 |
| FR-15 | P1 | in scope, exit 2 | deferred (AD-7, 14) | gap (B-3) |
| FR-16 | P1 | n/a | AD-10 | ok (see W-5) |
| FR-17 | P2 | in help now | deferred but Config carries Pop/Gens | warning W-7 |
| NFR performance, reproducibility, portability, testability, safety | n/a | 8.7, 9 | section 12 | ok |

## 2. Consistency

| ID | Severity | Owner | Docs | Conflict | Resolution needed |
|----|----------|-------|------|----------|-------------------|
| C-1 | Blocker | both | UX 8.4/8.5/11, Arch Q-12, AD-9 | UX: initial population is `Generation0.txt`, files 0..50, 51 reports, "generation 50". Arch: initial dump is `Generation5050.txt`, generations are `Generation0..49.txt`, Generation N is 0-based loop iteration. | Agree on one naming and numbering; UX summary and "Wrote N reports" line must follow Q-12 (or the owner overrides Q-12 via the PRD). |
| C-2 | Blocker | both | UX 8.1 `-outdir`, Arch AD-8 and section 12 `-out` | Two different flag names for the output directory. PRD names none. | One name, in all three docs. |
| C-3 | Blocker | both | UX 8.6 vs Arch AD-7, Q-11, section 8 | UX: validation with exit 2 (missing operand, bad label, rate range, killrate 1..90, bad seed), up to 5 errors reported. Arch: range validation is NOT in the faithful MVP; missing value or non-numeric is a LegacyCrashError exit 1; exit codes only 0/1. | Decide whether FR-15 is in this iteration. If yes, architecture needs the `validate` step and exit 2; if no, UX error table must be cut to legacy crash behavior and exit 1. UX also lacks a row for `LegacyCrashError`. |
| C-4 | Blocker | both | UX 5/8.6 vs Arch Q-11, section 8 | UX: unrecognized arg gives one stderr warning, exit 0. Arch: every switch value is re-scanned and prints `<token>: Argument Not Recognized!` on stdout; `-h` honored only as args[0]; no args prints help. UX says `-h` and order-independent parsing anywhere. | Align on stream (stdout vs stderr), per-value-token noise, and `-h` position. |
| C-5 | Blocker | both | UX 8.2 vs Arch section 8 "Help text" | UX supplies a rewritten help text (new sections, `-seed`, `-outdir`, `-gens`, `-pop`, scoring note, "-cx default"). Arch requires verbatim legacy `UI()` text plus one permitted note line. | Decide verbatim-legacy plus minimal additions, or a new help text; arch convention and Q-1 must match. |
| C-6 | Blocker | both | UX 8.4, 9 vs Arch Q-10, Q-7, AD-7 | UX promises a best-seating grid even when all scores are 0 (empty rules, floor at 0). Arch: when every weighted score is 0 the Best Individual block is `null` with no chromosome; plague may crash with a blank placeholder. UX has no state for `Best: null` or a legacy crash, and its primary example uses `-plague -killrate 75`, which arch says may crash. | Define stdout/exit behavior for null best and for LegacyCrashError; confirm the UX example command runs. |
| C-7 | Warning | both | UX 8.5 and 8.4 vs Arch section 4 | UX stdout shows `Proximity score`, `Isle score`, `Weighted fitness` and says "reuse the report labels". Arch labels are `Near By Score`, `Isle Score`, `Weighted Score`, `Total Fitness Score`. | Use the architecture terms (the ubiquitous language) everywhere. |
| C-8 | Warning | both | UX 8.1 `-gens/-pop` vs Arch section 14 | UX specifies `-gens`/`-pop` (ranges, even constraint) in help now; arch defers FR-17 (P2) though `Config` carries the fields. A flag with ranges is documented that arch says it will not parse (Q-11). | Defer in UX or admit in arch. |
| C-9 | Warning | ux-designer | UX 8.1 vs Arch Q-4 | UX says rates `0..1`, header echoes effective values. Arch Q-4: rate 0.0 silently becomes 0.9/0.1, inclusive compare (0.9 acts as 91%), killrate 0 becomes 50. UX never mentions it. | Add the preserved rate semantics to UX help/notes or flag them for later. |
| C-10 | Warning | both | UX 3 UXR-7/7 vs Arch section 14 | UX puts FR-14 (best grid) in scope and recommends P0; arch lists the final grid as deferred "presentation only" with no AD for it. | Pick; add the stdout wiring to arch if in scope. |
| C-11 | Warning | architect | UX 8.1 conflicts line vs Arch Q-1 | UX: last of conflicting selection/crossover switches wins (assumption). Arch Q-1 only says any value other than `-pmx` is cycle; it is silent on multiple selection switches. | State legacy behavior from source; UX note follows. |

## 3. Completeness

| ID | Severity | Owner | Gap | Where |
|----|----------|-------|-----|-------|
| G-1 | Blocker | product-manager | PRD text contradicts the binding owner decision in several places (see B-7). | PRD 4, 6, 7, 9 |
| G-2 | Warning | product-manager | OQ-5 (rule set used by the sample files) is open; FR-16 and the "100% match" metric cannot be verified. Arch hands the inference to the implementer with owner confirmation pending. | PRD 9, Arch AD-10, 15 |
| G-3 | Warning | architect | Reachability of the blank-placeholder crash in plague mode is an unverified assumption. If reachable under common rules, FR-8 plague is unusable in practice and the PRD success metrics are at risk. | Arch AD-7, 15 |
| G-4 | Note | none | UX error table and exit codes are mostly `[ASSUMPTION]`; Ctrl-C exit 130 is assumed. | UX 11 |
| G-5 | Note | none | Report label strings, line endings, Java double exactness assumed (OQ-4). Parity compares parsed numbers; reasonable. | Arch AD-8 |
| G-6 | Note | none | Loading/progress state deliberately absent (default run < 100 ms). Empty state (no rules) specified in UX 9. | UX 8.7, 9 |
| G-7 | Note | none | Arch assumes a working JVM for optional differential checks; not required. | Arch 3, 15 |

## 4. Language & context

Single bounded context (Seating Optimization) owns all P0 FRs; no map gaps.

| ID | Severity | Owner | Finding | Resolution needed |
|----|----------|-------|---------|-------------------|
| L-1 | Warning | both | See C-7: UX stdout labels diverge from arch terms and report labels. | Adopt arch language table. |
| L-2 | Warning | product-manager | PRD says "aisle" and "Generation N"; arch decided Go `Aisle` with `Isle` only in flag/label, and Generation 0..49 plus 5050. PRD should record the decision (PRD FR-6, FR-12). Arch flags the conflict correctly. | Update PRD terminology note. |
| L-3 | Note | none | Arch "Total Fitness Score" and "Weighted Score" match the PRD's total/weighted fitness. | none |

## Issues

### Blockers (must fix before build-package)

| ID | Owner | Resolution needed |
|----|-------|-------------------|
| B-1 | both | Resolve C-1: single file naming and numbering (Generation5050 plus 0..49 vs 0..50); fix UX 8.4 summary and Arch Q-12 accordingly. |
| B-2 | both | Resolve C-2: one output-directory flag name across PRD, UX, Arch. |
| B-3 | both | Resolve C-3: FR-15 validation and exit code 2 vs faithful crash behavior and exit 1; UX adds a LegacyCrashError state. |
| B-4 | both | Resolve C-4: unrecognized-argument and `-h` behavior (stream, per-token message, arg position). |
| B-5 | both | Resolve C-5: verbatim legacy help text vs UX rewritten help. |
| B-6 | both | Resolve C-6: null best individual, empty-rules behavior, and plague crash vs UX summary and example command. |
| B-7 | product-manager | Update PRD to the owner decision: OQ-3 defaults "fix" becomes "preserve (Q-n)"; OQ-2 closed as cycle default; FR-10 "never emit invalid" restated (inversion always valid; typed crash otherwise); section 6 `VerifyValidness` is not dead; section 7 Go 1.27.3 installed; FR-12 filenames and dir flag; FR-3 notes for per-value messages and rate semantics (Arch PRD-1..PRD-9); state whether FR-15 is MVP (UX UXR-1..9). |

### Warnings

| ID | Owner | Resolution needed |
|----|-------|-------------------|
| W-1 | both | Use arch score labels in UX stdout (C-7, L-1). |
| W-2 | ux-designer | Document preserved rate semantics (C-9). |
| W-3 | both | Decide FR-14 scope and wiring (C-10). |
| W-4 | architect | Specify legacy behavior for repeated selection/crossover switches (C-11). |
| W-5 | product-manager | Provide or confirm the sample rule set (OQ-5) (G-2). |
| W-6 | architect | Verify plague crash reachability from the Java source (G-3). |
| W-7 | both | Reconcile `-gens`/`-pop` (C-8) and PRD terminology note (L-2, owner product-manager). |

### Notes

1. UX 9 "Repeated rule scored twice" matches legacy intent; keep.
2. Parity compares parsed numbers; both UX and arch agree.
3. Arch AD-4 uses uniform `IntN(100)` instead of Java bias; PRD accepts non-parity of streams.
4. Several P0 FRs (FR-1, 2, 8..11) have no UX surface; acceptable for an engine concern.

## Do not invent

- Output directory flag name (`-out` vs `-outdir`).
- Generation file numbering (0..49 plus 5050 vs 0..50).
- Whether FR-15 range validation and exit code 2 exist in this iteration.
- Unrecognized-argument output stream and per-value message.
- Help text content (verbatim legacy vs rewritten).
- Rule set that produced the sample files (OQ-5).
- Behavior on null best individual and on LegacyCrashError at the console.
- Exact byte formatting of doubles beyond parsed-number comparison (OQ-4).
