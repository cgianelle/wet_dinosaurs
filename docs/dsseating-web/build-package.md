# Build package: DSSeating Web (visual classroom seating)

**Status:** Ready for implementation
**Last updated:** 2026-11-22
**Check report:** /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/check-report.md
**Sources:**
- PRD: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/prd.md (round 5)
- Routing: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/routing.md — Final `ux=run arch=run fast=no`
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/ux.md (revision 3)
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/architecture.md
- Reconciliation: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/reconciliation.md (W-7 agreed)

## 1. Outcome

A teacher draws their classroom (grid of desks inside four walls, with a front wall, doors and a teacher's desk), lists up to 50 students and rules (front, not near, Isle), runs the Go genetic algorithm once, and sees the best three arrangements on their own room with per-rule outcomes and reasons. Success is that at least one of the three is usable as the real seating plan. The GA stays behind a service; the browser holds no GA logic.

## 2. Build these requirements

| ID | Requirement | UX | ADs |
|----|-------------|----|-----|
| FR-1 | Grid 1 x 1 to 15 x 15, default 8 x 6; client never exceeds server limit | S1 | AD-5, AD-9 |
| FR-2, FR-3, FR-4 | Add (drag, click, paint, keyboard), move, remove desks; snap; 50-desk cap on every route, "Room is full (50 desks)" | S1 | AD-9 |
| FR-5, FR-6, FR-38 | Four wall bands, one front wall (default top, changeable), derived Back/Side labels, up to 3 doors on walls, 1 teacher's desk (uncounted, visual only); labelled by text/icon, not color | S1, S5 | AD-9, AD-11 |
| FR-7..FR-10 | Students: trim, max 40 chars, max 50, unique (trim, case and Unicode-normalization insensitive); edit/remove cascades rules | S2 | AD-9 |
| FR-11..FR-15 | Front, not near, Isle rules; list/edit/delete; block duplicates (incl. reversed pair), self-pair, missing student | S3 | AD-3, AD-9, AD-10 |
| FR-16 | Run enabled only if students = desks, at least 1 student, no rule errors; state exactly what blocks | S4 | AD-10 |
| FR-17, FR-24 | Run with busy indicator, one at a time; same input gives same result in a session | S4 | AD-6, AD-8 |
| FR-18, FR-19, FR-20, FR-35, FR-36 | Service takes desks plus front edge and opaque ids; returns top 3 distinct (whole run) with outcomes (front 3-state), reasons, `rulesMet`/`rulesTotal`, `weighted100` | S5 | AD-2, AD-3, AD-5, AD-7 |
| FR-21, FR-22, FR-23 | Results on the teacher's layout, switch options, highlight rule involvement, Out of date marking | S5, S6 | AD-11 |
| FR-25 | Failure keeps input, plain-language error, Try again | S6 | AD-5, AD-8, section 8 Errors |
| FR-26, FR-27 | No GA in browser; CLI engine behavior unchanged | n/a | AD-1, AD-7 |
| NFR-1, NFR-2 | Docker Compose dev/test/prod-like; supported, pinned versions | n/a | AD-13, section 9 |
| FR-29..FR-33 (P1) | Fill room, Paste a list, Undo/Redo, Cancel run, leave-page warning and Start over | S1, S2, S4, S7 | AD-8, AD-9 |
| FR-37 (P1) | When nothing satisfies every rule, name the option breaking the fewest | S5 | AD-3 |
| FR-28 (P2) | Results read-only (in MVP as behavior) | S5 | AD-11 |

FR-34 (P2, differences from Option 1) is optional; build last if at all.

## 3. Experience to implement

Full specs in `ux.md`. One page, two modes, one persistent canvas.

- **Happy path:** Plan mode (palette, canvas with wall ring, Students and Rules tabs, readiness checklist beside Run) then Run, busy panel with Cancel, then Results mode (option tabs, read-only canvas, rule outcomes list with reasons), then Edit plan.
- **Critical states:** Run blocked (checklist with fix links); running (editor locked, overlay); service failure banners per client error union (Unreachable, Timeout, Busy, Unexpected; input kept; Try again); stale results ("Out of date", names as of the last run, snapshot room); fewer than 3 arrangements; no option satisfies every rule; empty states for room, students, rules.
- **Accessibility:** WCAG 2.2 AA. Every drag has a click and keyboard equivalent; canvas is one composite tab stop with arrow navigation including wall segments; outcomes never by color alone (icon, text, outline style); live regions; 44 px targets; reduced motion; desktop 1024 px and wider.

## 4. Architecture to follow

Full decisions in `architecture.md`.

- **Paradigm:** two pure cores joined by one JSON contract (TS editor model; Go `seating` unchanged plus a pure `solver` facade). No shared code, only shared fixtures.
- **Structural seed:** `solver/`, `internal/api/`, `cmd/dsseating-server/`, `contract/fixtures/`, `docker-compose.yml`, `Dockerfile`, `web/{model,state,solver,ui}`; extend `internal/archtest`. No edits to `seating/`, `report/`, `internal/cli/`, `cmd/dsseating/`.
- **Binding ADs:**
  - AD-1: service is a Go facade; browser computes no scores, ranks, distances or outcomes; archtest enforces imports.
  - AD-2: `solver` rotates by front wall (depth/lateral), rebases to the desks' bounding box, builds a dense-rank front table, flags Isle on min/max occupied lateral line.
  - AD-3: outcomes and reasons (`row/rows`, `distance`, `column/columns`) computed in `solver`; drift-guard tests against the engine.
  - AD-4: names never cross the wire; ids opaque, client-generated.
  - AD-5: `POST /v1/solve`, closed error enum, shared fixtures, limits 15 x 15 / 50 / 50, `limits.ts` message table.
  - AD-6: seed from SHA-256 of canonical sorted input; no seed in UI or wire.
  - AD-7: top 3 distinct across the whole run; brute-force recomputation tests on all four front edges.
  - AD-8: one synchronous request, `RunBudget`, 30 s timeout, concurrency cap, client run state machine with Cancel and late-response discard.
  - AD-9: cell-based pure `Classroom` model, one reducer of named commands, snapshot history, no persistence, dnd-kit as gesture only.
  - AD-10: `runBlockers` pure function mirrored by the server.
  - AD-11: `RunResult` snapshot plus request fingerprint; Out of date is derived.
  - AD-12: one Go binary, same origin, counts-only logs.
  - AD-13: everything under Docker Compose, non-root, stateless.
- **Stack pins (exact):** Go 1.27.4, Node 26.13.1, alpine 3.24.4, React 19.3.1, TypeScript 7.0.2 (`tsc`) with TS 6.0.2 API alias, Vite 8.3.8, plugin-react 6.3.0, Vitest 5.1.1, `@dnd-kit/core` 6.3.1, zod 4.6.7, ESLint 10.15.0, typescript-eslint 8.73.0.
- **Owning contexts:** Classroom Planner (`web/`), Solving Service (`internal/api` + `solver`), Seating Engine (`seating`, unchanged), CLI + Report (unchanged).
- **Ubiquitous language:**

| Term | Meaning in this system | Do not call it |
|------|------------------------|----------------|
| Room | N x Y grid, four walls, doors, teacher's desk | classroom model, layout |
| Grid, cell | Lattice; cell is desk, empty or teacher's desk; walls and doors are not cells | tile, slot |
| Desk | Student desk cell; counts toward desk count | seat, table |
| Teacher's desk | Student-less, uncounted, visual only, max 1 | desk, marker |
| Wall | top/bottom/left/right band; one is front, opposite is Back, others Side | marker, zone |
| Front wall (`frontEdge`) | The only wall the GA uses; always set, default top | front marker, board |
| Door | Cell-aligned opening in a wall, max 3, visual only | marker, tile |
| Row, column (front-relative) | Line of desks parallel / perpendicular to the front wall, occupied lines only | screen row/column |
| Student | Named person; wire carries opaque `studentId` | person, pupil |
| Rule | front, notNear, isle (UI "Isle") | constraint |
| Run | One click sends room, students, rules to the service | solve, generate |
| Arrangement | One assignment with rank, score, outcomes | result, solution |
| Outcome | `met`, `neutral` (front only), `notMet` plus reason data | status, pass/fail |
| Stale | Results whose inputs changed (UI "Out of date") | outdated, dirty |

Code says `Aisle` and `Person` inside `seating`/`solver`; user text says "Isle" and "student".

## 5. Non-functional constraints

- Run p95 <= 5 s at 50 students / 50 desks / up to 15 x 15 (proposed; measure first, trigger at > 10 s). Drag stays smooth with 50 desks.
- Deterministic: same canonical input gives byte-identical response on the same Go version and OS.
- Integers only on the wire; `weighted100 / 100` at render; negative scores valid; never floor at 0.
- Privacy: no names on the wire or in logs; logs hold counts only; nothing persisted in the browser.
- Docker Compose for dev, test, prod-like; Docker the only prerequisite; non-root runtime, stateless, `/healthz`, logs to stdout. Gates: `go vet`, `go test`, `gofmt -l .` empty; `tsc`, `tsc6`, `eslint`, `vitest`, `vite build`.
- Accessibility per section 3.

## 6. Out of scope

Saving/reopening and autosave; print/export; mobile and touch; accounts and sharing; GA tuning or seed controls; new rule types; rules affected by doors, side/back walls or teacher's desk; free-form placement; fewer/more students than desks; manual editing of results; text rule language; registry publishing, CI provider, hosting.

## 7. Do not invent

- **Open:** A-4 run-time target confirmation after the first benchmark. A-5 hosting (no auth, CORS, registry, CI, `go:embed`). Zero-rule results wording (S5 does not specify "0 of 0"). No direction word for Isle "column N of M".
- **Assumed (treat as given):** teacher's desk is student-less and uncounted; doors cell-aligned, up to 3, one per wall position, removed when a shrink cuts their aligned cell; zero rules is a valid run; Front and Isle may both apply to one student; engine defaults (pop 100, 50 generations) pending measurement via `RunBudget`; history capped at 100; top 3 are best distinct individuals across the whole run; same-version PCG determinism; theme follows system setting; Vite/Vitest/TS-alias combination to be confirmed by the scaffold inside the container.
- Apply the 40-character name rule in paste (`addStudents`) as well as single add, and report names skipped as too long (UX S7).
- Allow in the archtest every stdlib package AD-8 needs in `internal/api`, while still forbidding `seating`, `report`, `internal/cli`.

## 8. Suggested implementation order

1. Compose scaffold (Go test target, web test target, dev, prod) and archtest extension; fixtures directory with contract fixtures.
2. `solver`: types, validation and error codes, AD-2 rotation/rebase, `FrontScores`, top-3 set, outcomes, seed; hand-computed, drift-guard and brute-force tests on all four front edges; benchmark at 50 desks and set `RunBudget`.
3. `internal/api` and `cmd/dsseating-server` (`/v1/solve`, `/healthz`, limits, slog counts).
4. `web/src/model`: `Classroom`, reducer commands, `runBlockers`, `toRequest`, fingerprint, history, `limits.ts`.
5. `web/src/solver` client with zod and error union; run state machine with Cancel.
6. Plan UI: canvas with wall ring, palette, room size and front wall controls, students, rules, readiness checklist.
7. Results UI: option tabs, read-only canvas, outcomes and reasons, stale and error banners.
8. P1: Fill room, Paste a list, Undo/Redo, Start over, leave-page warning, FR-37 banner; then accessibility pass and screen-reader smoke test.
