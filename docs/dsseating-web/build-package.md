# Build package: DSSeating Web (visual classroom seating)

**Status:** Ready for implementation
**Last updated:** 2026-11-21
**Check report:** docs/dsseating-web/check-report.md
**Sources:**
- PRD: docs/dsseating-web/prd.md
- Routing: docs/dsseating-web/routing.md — Final `ux=run arch=run fast=no`
- UX: docs/dsseating-web/ux.md
- Architecture: docs/dsseating-web/architecture.md

## 1. Outcome

A teacher draws their classroom grid (max 15 x 15, max 50 desks), lists up to 50 students, adds front / not near / Isle rules, presses Run once, and sees the top 3 arrangements on their own room with "N of M rules met", score and per-rule outcomes with reasons. Success is that at least one option is usable as the real seating plan. The GA stays behind a Go service; the browser holds no GA logic. The whole project builds, tests and runs under Docker Compose with Docker as the only prerequisite.

## 2. Build these requirements

Full text and notes are in `prd.md` section 4.

| ID | Requirement (short) | UX | ADs |
|----|---------------------|----|-----|
| FR-1 | Grid size 1x1..15x15, default 8x6; client never allows more than server | S1 | AD-5, AD-9 |
| FR-2 | Add desk by drag/snap; max 50 desks by every route | S1 | AD-9 |
| FR-3, FR-4 | Move desk (occupied drop rejected, returns); remove desk | S1 | AD-9 |
| FR-5 | Marker tokens in cells: front, back, side, door, teacher's desk; limits 1/1/2/3/1 | S1 | AD-9 |
| FR-6 | Exactly one Front on a non-corner edge cell; its edge is the front edge | S1, S4 | AD-10, AD-11 |
| FR-7..FR-10 | Students: add (trim, max 40 chars), edit, remove with rule cascade, max 50, unique (trim, case, NFC) | S2 | AD-4, AD-9 |
| FR-11..FR-15 | Front, not near, Isle rules via forms; list/edit/delete; block duplicates (reverse pair too), self pair, missing student | S3 | AD-9, AD-10 |
| FR-16 | Run only when students = desks, >= 1 student, valid Front, no rule errors; state exactly what blocks | S4 | AD-10 |
| FR-17 | Run sends snapshot, busy indicator, one run at a time | S4 | AD-8 |
| FR-18..FR-20 | GA domain: desks on grid + front edge, ids only; top 3 distinct across whole run; outcomes Met / Neutral (front only) / Not met | S5 | AD-1, AD-2, AD-3, AD-5, AD-7 |
| FR-21, FR-22 | Results on the teacher's room, switch options, rule outcomes, highlight on select | S5 | AD-11 |
| FR-23 | Return to editor; results stay marked Out of date with names as of the run; rename alone does not mark stale | S6 | AD-4, AD-11 |
| FR-24 | Deterministic within a session; seed hidden | S4 | AD-6 |
| FR-25 | Service failure: plain-language error, input kept, retry | S6 | AD-5, AD-8 |
| FR-26 | Browser reaches GA only through the service layer | section 12 | AD-1 |
| FR-27 | Engine/CLI behavior unchanged | n/a | AD-1, AD-7 |
| FR-35 | Each outcome carries service-supplied reason data | S5 | AD-3, AD-5 |
| FR-36 | "N of M rules met" from `rulesMet`/`rulesTotal`; score secondary, signed | S5 | AD-3 |
| NFR-1 | Docker Compose environments (dev, test, prod-like); Docker only; gates via Compose; stateless, non-root, health, stdout logs, local builds | n/a | AD-13, AD-12 |
| NFR-2 | Supported, pinned versions (exact) | n/a | section 9 |
| FR-29 (P1) | Fill room | S7 | AD-9 |
| FR-30 (P1) | Paste a list | S7 | AD-9 |
| FR-31 (P1) | Undo/redo, session only | S1 | AD-9 |
| FR-32 (P1) | Cancel run; late response discarded | S4 | AD-8 |
| FR-33 (P1) | Leave-page warning and Start over (clears room, students, rules and results; one undoable step) | S1, S6 | AD-9 |
| FR-37 (P1) | When no option meets every rule, say so and name the option with highest `rulesMet` (ties to lower rank) | S5 | AD-3 |

P2 FR-28 (results read-only) is built as behavior; FR-34 (differences toggle) only if time allows.

## 3. Experience to implement

See `ux.md`. One page, two modes (Plan, Results), one shared `RoomCanvas`. Docker has no UX impact.

- Happy path: set size, place desks, place Front on an edge cell, add students, add rules, checklist green, Run, Results opens on Option 1, click a "Not met" rule to see involved desks, switch options.
- Critical states: Run blocked with actionable checklist lines; running panel with Cancel; service failure banner keeping input; Out of date banner with snapshot render; empty, full (50) and invalid-drop states.
- Front tool unavailable only when both grid dimensions are 2 or less; front bar on `left` for 1-wide rooms, `top` for 1-tall rooms.
- Neutral outcome exists only with an odd number of desk rows (3 or more).
- Accessibility: WCAG 2.2 AA; keyboard parity for every drag; outcomes never color-only; 44 px targets; live regions; reduced motion; desktop only (>= 1024 px).

## 4. Architecture to follow

See `architecture.md`.

- Paradigm: functional core, imperative shell on both sides of one JSON contract. Pure TS `model` and pure Go `solver` facade; `seating` engine unchanged.
- Structural seed: `solver/`, `internal/api/` (adds `GET /healthz`), `cmd/dsseating-server/`, `contract/fixtures/`, `web/src/{model,state,solver,ui}`, root `Dockerfile`, `web/Dockerfile`, `docker-compose.yml`, `.dockerignore`; extend `internal/archtest`.
- Binding ADs:
  - AD-1: Go facade in same module; browser computes no scores, ranks, distances, outcomes; import rules enforced by test; `seating` not modified.
  - AD-2: `solver` is the only Room-to-`Problem` translation.
  - AD-3: outcome definitions D-1..D-3, stretched front curve, reason data, `rulesMet`/`rulesTotal`, drift-guard test.
  - AD-4: names never cross the wire; ids opaque, client-generated.
  - AD-5: `POST /v1/solve`, closed error enum, limits 50/50/15x15, shared fixtures, zod decode.
  - AD-6: seed = SHA-256 of canonical sorted input; `webStream` constant in `solver`.
  - AD-7: top 3 distinct across the whole run; independent brute-force recomputation test.
  - AD-8: synchronous run, `RunBudget` is the only tuning point, 30 s timeout, concurrency cap, run state machine with `runId`, AbortController, Cancel.
  - AD-9: pure cell-based `Classroom` reducer, one history stack (cap 100), no persistence, dnd-kit gestures dispatch the same commands.
  - AD-10: `runBlockers` pure function mirrored by server codes.
  - AD-11: `RunResult` snapshot with fingerprint; Out of date derived; `frontEdgeOf` rule.
  - AD-12: one Go binary, same origin, no CORS/auth/persistence, logs carry counts only.
  - AD-13: Docker Compose owns the toolchain. Profiles `dev` (api on 8080 + Vite on 5173, proxy to `http://api:8080`), `prod` (single `app` service from the root `Dockerfile` `runtime` target, same origin, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, non-root user 10001), `test` (`go-test`, `web-test`). Health via `GET /healthz`; logs to stdout with json-file rotation; no volumes beyond dev bind mounts; images built locally, none published.
- Stack pins (all exact; no `^`/`~`/`latest`; `.npmrc` `save-exact=true`; lockfile committed; `npm ci`; Docker tags exact; `go.mod` no `require`): Go 1.27.4 (`golang:1.27.4-alpine3.24`); Node 26.13.1 (`node:26.13.1-alpine3.24`, `engines` `>=24`); runtime `alpine:3.24.4`; Compose v2 >= 2.17; React 19.3.1; TypeScript 7.0.2 as `"@typescript/native": "npm:typescript@7.0.2"` (`tsc`) plus 6.0.2 as `"typescript": "npm:@typescript/typescript6@6.0.2"` (`tsc6`, API for tools); Vite 8.3.8; `@vitejs/plugin-react` 6.3.0; Vitest 5.1.1; `@testing-library/react` 16.3.3; `@dnd-kit/core` 6.3.1; zod 4.6.7; ESLint 10.15.0; typescript-eslint 8.73.0. Lifecycle table in architecture section 9.
- Owning contexts: Classroom Planner (`web/`), Solving Service (`solver`, `internal/api`), Seating Engine (`seating`), CLI + Report (untouched).

Ubiquitous language:

| Term | Meaning in this system | Do not call it |
|------|------------------------|----------------|
| Room | N x Y grid plus markers | classroom model, layout |
| Grid, cell | The lattice; a cell is a desk, empty, or holds a marker | tile, slot |
| Desk | A desk cell; counts toward desk count | seat, table |
| Marker | Non-desk token in a cell: front, back, side, door, teacher's desk | zone, widget |
| Front marker, front edge | Exactly one; the edge it sits on | top, board |
| Student | Named person, 1:1 with a desk at Run; opaque `studentId` on the wire | person, pupil, user |
| Rule | front, not near (pair), Isle (user spelling "Isle") | constraint, wish |
| Run | One click: send room, students, rules | solve, generate |
| Arrangement | One student-to-desk assignment with rank, score, outcomes | result, plan, solution |
| Rank, score | 1..3 and `weighted100` (display value / 100) | fitness |
| Outcome | Per rule per arrangement: met / neutral (front only) / notMet, with reason | status, pass/fail, satisfied/violated |
| Stale | Results whose inputs changed (user text "Out of date") | outdated, dirty |

## 5. Non-functional constraints

- Run p95 <= 5 s for 50 students on up to 15 x 15 (proposed; measure first, tune only in `RunBudget`); revisit async at p95 > 10 s.
- Drag stays smooth with 50 desks (CSS-only highlights, memoized cells).
- Deterministic within a session and Go version/OS; scores are integers, never floored.
- Names never in requests, logs or URLs; logs hold counts only; nothing stored in the browser.
- Failed or cancelled runs never lose input or earlier results.
- NFR-1 and NFR-2 as in section 2. The host Node and Go are never used by documented workflows.
- Gate commands (exit code is the result):
  - `docker compose --profile test run --rm go-test` (`gofmt -l . | (! grep .) && go vet ./... && go test ./...`)
  - `docker compose --profile test run --rm web-test` (`npm run check` = `tsc --noEmit && tsc6 --noEmit && eslint . && vitest run && vite build`; TS 7 `tsc` is authoritative)
  - Develop: `docker compose --profile dev up --build` (browser `http://localhost:5173`). Production-like: `docker compose --profile prod up --build` (`http://localhost:8080`). Lockfile update: `docker compose --profile dev run --rm web npm install`.
- `fetch` appears only in `web/src/solver/`, enforced by a test.

## 6. Out of scope

Saving/reopening and autosave; print/export; mobile/touch; text rule language; free-form placement; fewer/more students than desks; GA tuning and seed controls; new rule types; scoring effects of doors, back, side or teacher's desk; accounts and sharing; manual editing of results; desks greater than students; publishing images to a registry; CI provider, digest pinning and hosting choice.

## 7. Do not invent

- **Open:** run-time target confirmation (A-4) after measurement; hosting, CI provider and registry (A-5, non-blocking).
- **Assumed (treat as given):** engine defaults (pop 100, 50 generations) give acceptable quality at 50 students (measure first); top 3 are best distinct individuals seen across the run; undo history cap 100; zero rules is a valid run; Front and Isle may both apply to one student; theme follows system setting; no auth for MVP test data; `flag` allowed in `cmd/dsseating-server` only; owner's machine has Docker with Compose >= 2.17 and BuildKit; the pinned web toolchain installs cleanly on Node 26.13.1 (scaffold confirms in the container before committing the lockfile); TypeScript 7 and `@typescript/typescript6` have no published support-end date.
- Do not change marker semantics, limits, outcome definitions or wording ("Isle", "student", Met/Neutral/Not met); do not touch `seating`, `report`, `internal/cli`, `cmd/dsseating`.

## 8. Suggested implementation order

1. Docker scaffold: `docker-compose.yml`, `Dockerfile`, `web/Dockerfile`, `.dockerignore`; confirm the Go gate runs green through Compose and the pinned web toolchain installs; commit the lockfile.
2. Go `solver`: types, limits, `FrontScores`, rotation/rebase, outcomes with reasons, seed, top-3 set; fixtures under `contract/fixtures/`; archtest import rules.
3. Benchmark a 50-desk irregular room; adjust only `RunBudget` if needed.
4. `internal/api` (`/v1/solve`, `/healthz`, errors, slog counts, timeout, concurrency cap) and `cmd/dsseating-server`; `prod` profile up with health.
5. TS `model`: `Classroom`, commands, history, `runBlockers`, `frontEdgeOf`, `toRequest`, fingerprint, limits module; unit tests.
6. `web/src/solver` client with zod and run state machine (Cancel).
7. UI slice: room canvas and palette, students, rules, readiness checklist, Run.
8. Results view with outcomes, highlights, stale snapshot, errors.
9. P1 items: Fill room, Paste list, Undo/Redo UI, Start over, leave-page warning, FR-37 banner; accessibility smoke test; both Compose gates green.
