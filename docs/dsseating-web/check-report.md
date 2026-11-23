# Check report: DSSeating Web (visual classroom seating)

**Status:** PASS
**Last updated:** 2026-11-22
**Mode:** full
**Inputs expected:** 5 (`prd.md`, `routing.md`, `ux.md`, `architecture.md`, `reconciliation.md` present)
**Inputs received:** 5
**Sources:**
- PRD: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/prd.md (round 5)
- Routing: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/routing.md — Final `ux=run arch=run fast=no`
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/ux.md (revision 3)
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/architecture.md (includes section 18 UX review)
- Reconciliation: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/reconciliation.md (one entry, W-7, agreed)
- Previous `check-report.md`: n/a (no findings carried over, so no IDs to reuse)

## Fan-in

- [x] `prd.md` exists and is non-empty
- [x] `routing.md` exists and its Final has no `pending` (`ux=run arch=run fast=no`)
- [x] `ux.md` exists and is non-empty
- [x] `architecture.md` exists and is non-empty
- [x] Mode matches routing: `full` with a both-routed Final

## Verdict

**PASS**: blocking = 0 and warnings = 0.

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 0 | 0 | 6 |

## 1. Coverage

| FR / NFR | Priority | UX | Architecture | Status |
|----------|----------|----|--------------|--------|
| FR-1 grid size, 15 x 15, default 8 x 6 | P0 | S1 | AD-5 (limits), AD-9 | ok |
| FR-2 add desk, snap, 50 cap on every route | P0 | S1 | AD-9 | ok |
| FR-3 move desk, reject on occupied | P0 | S1 | AD-9 | ok |
| FR-4 remove desk | P0 | S1 | AD-9 | ok |
| FR-5 walls, up to 3 doors, teacher's desk | P0 | S1, S5 | AD-9, AD-11, section 4 | ok |
| FR-6 front wall always set, default top | P0 | S1 | AD-2, AD-9, AD-10, AD-11 | ok |
| FR-7 add student, trim, 40 chars | P0 | S2 | AD-9 | ok |
| FR-8 edit/remove student, cascade rules | P0 | S2 | AD-9 | ok |
| FR-9 50 student limit | P0 | S2 | AD-5, AD-9 | ok |
| FR-10 unique names | P0 | S2 | AD-9 | ok |
| FR-11, FR-12, FR-13 front / not near / Isle rules | P0 | S3 | AD-3, AD-9 | ok |
| FR-14 rule list, edit, delete | P0 | S3 | AD-9 | ok |
| FR-15 rule validation | P0 | S3 | AD-9, AD-10, AD-5 | ok |
| FR-16 Run blockers | P0 | S4 | AD-10 | ok |
| FR-17 Run, busy, no concurrent run | P0 | S4 | AD-8 | ok |
| FR-18 GA accepts desk set, 50 desks, opaque ids | P0 | section 12 | AD-2, AD-4, AD-5 | ok |
| FR-19 top 3 distinct | P0 | S5 | AD-7 | ok |
| FR-20 per-rule outcomes, front 3-state | P0 | S5 | AD-3 | ok |
| FR-21 results on own layout, switch options | P0 | S5 | AD-11 | ok |
| FR-22 violated rules distinguished, highlight | P0 | S5 | AD-11 | ok |
| FR-23 stale results | P0 | S6 | AD-11 | ok |
| FR-24 determinism | P0 | S4 | AD-6 | ok |
| FR-25 failure keeps input, retry | P0 | S6 | AD-5, AD-8, section 8 Errors | ok |
| FR-26 front end only via service | P0 | section 12 | AD-1 | ok |
| FR-27 CLI compatibility | P0 | n/a (not a screen) | AD-1, AD-7 | ok |
| FR-35 service-supplied reasons | P0 | S5 | AD-3, AD-5 | ok |
| FR-36 "N of M met", signed score | P0 | S5 | AD-3 (`rulesMet`, `rulesTotal`) | ok |
| FR-38 walls and doors labelled, not color alone | P0 | S1, S5, section 10 | AD-9 (`wallRoles`) | ok |
| FR-29..FR-33 Fill room, Paste, Undo/Redo, Cancel, leave warning | P1 | S1, S2, S4, S7 | AD-9, AD-8 | ok |
| FR-37 fewest-broken banner | P1 | S5 | P-12, AD-3 | ok |
| FR-28, FR-34 | P2 | S5 | AD-11 (FR-28); FR-34 client-only presentation | ok (P2, optional) |
| NFR-1 Docker Compose operability | P0 | n/a | AD-13, section 13 | ok |
| NFR-2 supported, pinned versions | P0 | n/a | section 9 | ok |
| NFR Performance, Privacy, Reliability, Accessibility, Determinism | P0 | S1, S4, section 10 | AD-4, AD-6, AD-8, AD-12, section 12 | ok |

## 2. Consistency

Every row of architecture section 18 (UXR-1..UXR-7) was re-tested independently against `ux.md` and `prd.md`. All serve the UX; none is a conflict. Spot checks that agree across all three docs: wall labels and rotation; door cell-alignment, corners excluded, one per position, limit 3; front-relative rows and Isle columns on all four front walls (AD-2 rotation vs UX S3/S5 wording); fingerprint rule for Out of date (front wall yes, doors and teacher's desk no, rename no); Start over as one undo step that restores results; Cancel and late-response discard; error-union to S6 banner mapping.

| ID | Severity | Class | Owner | Docs | Conflict | Resolution needed |
|----|----------|-------|-------|------|----------|-------------------|
| (none) | | | | | | |

## 3. Completeness

| ID | Severity | Class | Owner | Gap | Where |
|----|----------|-------|-------|-----|-------|
| (no Blockers or Warnings; see Notes 1, 3 and 5) | | | | | |

## 4. Language & context

Every P0 FR maps to an owning context through the context map's "Owns" column (Planner: editing, validation, run state, results display, FR-38; Solving Service: contract, mapping, outcomes, reasons, seed, FR-18/19/20/24/35; Seating Engine: scoring, FR-27). No term contradicts the PRD (see Note 2).

| ID | Severity | Class | Owner | Finding | Resolution needed |
|----|----------|-------|-------|---------|-------------------|
| (none) | | | | | |

## 5. Routing backstop

All routed specs present; nothing skipped.

## 6. Reconciliation

| Entry | Status | Complete | Specs match | PRD (FR-28) | Proof and ruling |
|-------|--------|----------|-------------|-------------|------------------|
| W-7 | agreed | yes (Conflict, Proposal, Reply `accept`, Outcome; no counter, so no Final position needed) | yes: UX S6 has the Busy variant, no "service rejected the input" variant, and the same one-to-one mapping; architecture AD-10 and section 8 "Errors" state the same mapping; AD-5 keeps `message` developer-only | ok (FR-25: input kept, plain-language error, Try again re-sends) | n/a (no Claim) |

### Compromises vs PRD

None.

| ID | Log entry | PRD line | Conflict |
|----|-----------|----------|----------|
| (none) | | | |

## Issues

### Blockers (must fix before build-package)

| ID | Class | Owner | PRD change? | Log entry | Resolution needed |
|----|-------|-------|-------------|-----------|-------------------|
| (none) | | | | | |

### Warnings

| ID | Class | Owner | PRD change? | Log entry | Resolution needed |
|----|-------|-------|-------------|-----------|-------------------|
| (none) | | | | | |

### Notes

1. Zero-rule runs are allowed (UX assumption, FR-16 does not require rules), but S5 gives no wording for "0 of 0 rules met" or for the FR-37 banner in that case. Implementer must not invent a banner; show the score and options without a rules claim, and ask if blocked.
2. Language: architecture section 4 lists "satisfied/violated" as retired wording and "plan" as a word not to use for an arrangement. PRD FR-22 and FR-37 still use "violated" and "satisfies", and UX copy uses "Seating plans" and "Option N" (and "Plan mode" for the editor). These are copy-level differences, not data or contract differences; UX owns user copy.
3. `addStudents` (AD-9) returns skipped lists for "duplicates, over-limit". UX S7 also skips names over 40 characters and lists them as too long. The reducer's 40-character rule applies to `addStudent`; the implementer must apply it in `addStudents` too and report a too-long reason.
4. AD-1's import allow-list for `internal/api` omits packages AD-8 needs (for example `runtime`, `errors`, `sync`). The archtest extension must allow what AD-8 uses while still forbidding `seating`, `report` and `internal/cli`.
5. Architecture P-6 and AD-5 call the 40-character name limit UX-only; PRD FR-7 now states it. It stays client-only (names never reach the server), so behavior is unchanged; the wording is stale.
6. AD-9 picks `@dnd-kit/core` while UX S1 specifies keyboard navigation around the wall ring and a single composite grid tab stop. Both require the same commands; whether the library's keyboard sensor can deliver UX's ring navigation is an implementation risk, covered by the screen-reader acceptance test.

## Do not invent

- A-4: the run-time target (p95 <= 5 s) is proposed, not confirmed. Measure first.
- A-5: hosting is undecided. Do not add auth, CORS, a registry, a CI provider or `go:embed`.
- Teacher's desk is student-less, uncounted and visual only (PRD round 4 assumption, not confirmed). Doors: cell-aligned, up to 3, one per wall position (assumed).
- No direction word for Isle "column N of M" in any text (UX section 11).
- Engine defaults (population 100, 50 generations) may need `RunBudget` scaling after measurement; no other tuning surface.
- Zero-rule result wording (Note 1).
