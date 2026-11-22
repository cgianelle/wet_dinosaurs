# Check report: DSSeating Port (Java GA to Go, bugs fixed)

**Status:** PASS
**Last updated:** 2026-10-31
**Inputs expected:** 3 (`prd.md`, `ux.md`, `architecture.md`)
**Inputs received:** 3
**Sources:**
- PRD: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/prd.md
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/ux.md
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-port/architecture.md

## Fan-in

- [x] `prd.md` exists and is non-empty
- [x] `ux.md` exists and is non-empty
- [x] `architecture.md` exists and is non-empty

## Verdict

**PASS**. Blocking = 0 and warnings = 0.

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 0 | 0 | 6 |

Help-width check (requested): the PRD sets no help width. `ux.md` states 90 columns in section 8.1 (text spec and the test assertion), section 9 (Long content) and section 10 (Accessibility). `architecture.md` states no help width. No "80 column" statement remains in any of the three specs. The only other "80" hits are unrelated (the Java help range "1-90" in R-5 and the 90% quality threshold in D17).

## 1. Coverage

| FR / NFR | Priority | UX | Architecture | Status |
|----------|----------|----|--------------|--------|
| FR-1 layout, people, defaults | P0 | 8.4 seat order, 12 | AD-2, Layout/People | ok |
| FR-2 initial population, gen 5050 | P0 | 8.4 | AD-6 step 1, AD-7 | ok |
| FR-3 front-row score | P0 | 8.1 help | AD-2 table, AD-4 | ok |
| FR-4 Near By distance | P0 | 8.1 | AD-4 half-unit integers | ok |
| FR-5 `-strictprox` | P0 | 8.1, 8.3 | AD-4, AD-8 | ok |
| FR-6 Isle score | P0 | 8.1 | AD-2 `Aisle`, AD-4 | ok |
| FR-7 Total and Weighted, no floor | P0 | 8.4 | AD-4 `Weighted100` | ok |
| FR-8 random selection | P0 | 8.1 | AD-5 | ok |
| FR-9 queen | P0 | 8.1 | AD-5 | ok |
| FR-10 plague, `-killrate` | P0 | 8.1, 8.3, 9 | AD-5 | ok |
| FR-11 beeplague | P1 | 8.1 | AD-5 | ok |
| FR-12 PMX / CX | P0 | 8.1 | AD-5 | ok |
| FR-13 mutation | P0 | 8.1 | AD-5 | ok |
| FR-14 rate semantics | P0 | 8.3, 9 | AD-3 | ok |
| FR-15 run order | P0 | 5.1 | AD-6 | ok |
| FR-16 reports, atomic | P0 | 8.4, 8.3 | AD-7, section 11 | ok |
| FR-17 CLI flags, help anywhere | P0 | 6, 8.1, 8.3 | AD-8 | ok |
| FR-18 help text | P0 | 8.1 | AD-8 | ok |
| FR-19 validation, notes | P0 | 8.3, 9 | AD-4, AD-8 | ok |
| FR-20 seed, one RNG | P0 | 8.2 | AD-3 | ok |
| FR-21 best never null | P0 | 8.2, 8.4 | AD-4 | ok |
| FR-22 unit tests | P0 | 8.1, 12 | AD-9 | ok |
| FR-23 sample tests | P1 | 8.4, U-1 | AD-9 | ok |
| FR-24 stdout summary | P0 | 8.2 | AD-8 | ok |
| FR-25 error format | P0 | 8.3, 8.5 | AD-8, section 8 | ok |
| NFR Performance | | 9 | section 12, AD-9 benchmark | ok |
| NFR Reproducibility | | 8.2, 12 | AD-3, AD-4, AD-6 | ok |
| NFR Portability | | 4 | AD-1, section 9 | ok |
| NFR Maintainability | | 12 | AD-1 | ok |
| NFR Safety | | 8.3, 9 | AD-8 recover | ok |

## 2. Consistency

| ID | Severity | Owner | Docs | Conflict | Resolution needed |
|----|----------|-------|------|----------|-------------------|
| C-1 | none | | PRD / UX / Arch | None found. Repeated identical selection or crossover flag is an exit-2 error in all three. Stdout shape (3 PRD items, 8 UX lines) fits AD-8. Error format, exit codes, notes order and value-consumption rule agree. UX example Weighted Score 119.16 matches the FR-7 formula for F=54, N=110, I=-10. Temp-file naming (UX recognisable prefix, AD-7 `.Generation*.tmp`) agrees. | none |

## 3. Completeness

| ID | Severity | Owner | Gap | Where |
|----|----------|-------|-----|-------|
| G-1 | Note | | U-11 / R-8: on a write failure, earlier completed files remain. Both UX and architecture state the same reading and the same default, so this is not a conflict. The owner has not explicitly confirmed it. | ux.md 3, architecture.md AD-7, 17 |
| G-2 | Note | | Empty, error, success and no-progress states are covered for each surface. Loading is explicitly "not applicable" (sub-second run). | ux.md 8, 9 |

## 4. Language & context

| ID | Severity | Owner | Finding | Resolution needed |
|----|----------|-------|---------|-------------------|
| L-1 | Note | | Terms agree. Architecture flags person/student and individual/chromosome as kept distinctions and permits "rules" in user text. UX uses "rules" and "students" consistently. "Isle" spelling kept in user text and labels. | none |
| L-2 | Note | | The context map has no explicit FR-to-context table. Ownership is derivable: engine owns FR-1..15, 21; Report owns FR-16 format; CLI owns FR-17..20, 24, 25 and atomic file creation. | none |
| L-3 | Note | | UX requires the summary and report `Best Individual:` block to share one formatter. Architecture puts summary formatting in `internal/cli` and block formatting in `report`. CLI already depends on `report`, so reuse is allowed. The implementer should call the `report` formatter from `cli`. | none |

## Issues

### Blockers (must fix before build-package)

None.

### Warnings

None.

### Notes

1. Help max width is 90 columns in `ux.md` only. No spec states 80.
2. U-11 / R-8: earlier completed files remain after a later write failure. Treat as assumed.
3. L-2: no explicit FR-to-context table, but ownership is derivable.
4. L-3: share the best-individual formatter via `report`.
5. `architecture.md` R-9 still describes the UX "draft's" extra lines, which UX has already removed. Stale but harmless.
6. Open UX items U-1, U-10 and U-11 each have a stated default and do not block the build.

## Do not invent

- Do not choose between "keep earlier completed files" and "remove all 51 on any failure" without the owner (U-11 / R-8). The default is to keep them.
- Do not make identical repeated selection or crossover flags idempotent (U-10). The default is an exit-2 error.
- Do not add stdout lines beyond the three FR-24 items. Do not add rate/seed/layout flags, a seating grid, or JSON output.
- Do not assert exact RNG streams in tests.
- `[ASSUMPTION]` items: LF line endings, "did you mean" hint (optional), a value equal to a known option name counts as missing, queen "others" drawn with replacement excluding the queen, PMX block start uniform in `[0, n-4]`, 49-underscore separator, the seed range message.
