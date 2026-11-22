# PRD: DSSeating Web (visual classroom seating)

**Status:** Draft
**Author:** product-manager agent (owner decisions relayed 2026-11-21)
**Last updated:** 2026-11-21
**Slug:** dsseating-web

**Revision note (round 2):** Owner approved the delta from the UX/architecture/check review (B-1, B-2, B-3, W-1, W-6 and PRD-1..15, P-1..P-10). Markers are cell tokens; grid max 15 x 15; 50-desk cap everywhere; "satisfied" definitions confirmed; Fill room, Paste a list, Undo/Redo and Cancel run are in the MVP as P1; autosave stays out. New FRs FR-29..FR-37. FR IDs are stable and none were renumbered. Status stays Draft.

**Revision note (round 3):** Owner added a Docker requirement: NFR-1 (Operability, Docker Compose environments) and NFR-2 (supported, pinned versions), with matching scope, constraint and assumption lines. No FR changed.

## 1. Problem Statement

Teachers seat a class under competing constraints: some students need the front, some must not sit near each other, some must sit on the outside columns ("Isle"). Doing this by hand for up to 50 students is slow and error-prone. The existing DSSeating genetic algorithm (GA, ported to Go, see `docs/dsseating-port/prd.md`) solves this well, but it is a command-line tool with a fixed 20-student, 5x4 room and text-file output, unusable by a typical teacher.

The owner wants a modern React/TypeScript web app in which a teacher draws their classroom, enters students and rules, runs the GA, and sees the best three arrangements drawn on their own room. The GA stays a separate bounded domain behind a service layer that the front end calls.

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Teacher can stage their real classroom from the results | Teacher judges at least one of the top 3 arrangements usable as the seating plan | Ultimate success measure; qualitative, validated with owner and sample teachers (threshold TBD, owner) |
| Run is responsive | Time from clicking Run to results shown, 50 students, up to 15 x 15 grid | p95 <= 5 s (proposed; confirmed after the architect's first measurement) |
| Results are trustworthy | Every rule outcome matches an independent recomputation of the arrangement | 100% in tests |
| GA domain stays separate | Front end contains no GA logic; reaches it only through the service layer | Verified by import tests and review |

Non-goals: saving/reopening classrooms (including autosave to the browser), printing/export, mobile, accounts or sharing, GA parameter tuning, new rule types, free-form (non-grid) placement, a text rule language.

## 3. Users & Use Cases

- **Primary user:** a teacher on a laptop or desktop. Builds the room, lists students, states rules, runs the GA, compares three results, picks one.
- **Secondary user:** none for MVP.

Today: seating charts by hand, on paper or in a spreadsheet, or the CLI (not usable by teachers).

## 4. Functional Requirements

Grid terms: the room is an N x Y grid of cells. A cell is a desk, empty, or holds a marker token. "Desk count" is the number of desk cells.

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1 | The teacher can set the room grid size (N columns by Y rows). Minimum 1 x 1, maximum 15 columns x 15 rows, default 8 x 6. | P0 | Server enforces the same limit; the client must never allow more than the server accepts |
| FR-2 | The teacher can add a desk to the grid by dragging it to a cell, with snap-to-grid placement. The room holds at most 50 desks; adding a desk beyond 50 is refused with a clear message ("Room is full (50 desks)"). | P0 | The cap applies to every way of adding desks (drag, click-to-place, paint-drag, Fill room) |
| FR-3 | The teacher can move a placed desk to another empty cell by drag and drop, with snap-to-grid. | P0 | Dropping on an occupied cell is rejected with the desk returning to its origin |
| FR-4 | The teacher can remove a desk from the grid. | P0 | |
| FR-5 | The teacher can place and move marker tokens in grid cells by drag and drop with snap-to-grid: front, back, side, door, and the teacher's desk. Markers are not student desks and do not count toward desk count. UI limits: Front 1 (required), Back 1, Side 2, Door 3, Teacher's desk 1. | P0 | Markers are cell tokens. UI-enforced limits; the GA ignores all markers except front. Resolves A-2, A-7 |
| FR-6 | The room must have exactly one front marker, placed on a non-corner edge cell, for the GA to run. The grid edge it sits on (any of the four) is the front edge. | P0 | Back, side, door and teacher's desk markers are optional and visual only |
| FR-7 | The teacher can add a student by name. Names are trimmed on entry and otherwise shown exactly as entered (no conversion to labels in the UI). Empty names are rejected; maximum length is 40 characters. | P0 | |
| FR-8 | The teacher can edit and remove a student. Removing a student removes that student's rules. | P0 | |
| FR-9 | The app rejects more than 50 students, with a clear message. | P0 | |
| FR-10 | Student names must be unique within a class. Uniqueness is checked after trimming, case-insensitively and ignoring Unicode normalization differences, with a clear message on a duplicate. | P0 | |
| FR-11 | The teacher can add a "front" rule for a student via a form (student should sit near the front). | P0 | Legacy front-row scoring semantics |
| FR-12 | The teacher can add a "not near" rule for a pair of two different students via a form. | P0 | Legacy proximity semantics (default legacy scoring) |
| FR-13 | The teacher can add an "Isle" rule for a student via a form (student must sit in the outside columns). | P0 | UI spelling "Isle"; UX may add a plain-language gloss |
| FR-14 | The teacher can view, edit and delete rules in a list. | P0 | |
| FR-15 | The app blocks and explains: duplicate rules (including a not-near pair in reverse order), a not-near rule pairing a student with themselves, rules naming a student that no longer exists. | P0 | Matches CLI strictness (no rule scored twice) |
| FR-16 | Run is enabled only when: student count equals desk count, there is at least 1 student, exactly one front marker exists and sits on a non-corner edge cell, and there are no rule errors. Otherwise the app states precisely what blocks it, and for a count mismatch says how to fix it (for example "Add 2 students or remove 2 desks"). | P0 | 1:1 student-to-desk ratio is an MVP rule |
| FR-17 | Clicking Run sends the room layout, students and rules to the GA service and shows a busy indicator while waiting; the teacher cannot start a second run concurrently. | P0 | The engine reports no progress, so no progress bar |
| FR-18 | The GA domain accepts a room defined as a set of desk positions on a grid with a front edge, up to 50 desks, and up to 50 students identified by opaque ids. | P0 | WHAT only; engine today supports only 20 students (A-T) on a 5x4 grid |
| FR-19 | The GA domain returns the top 3 distinct arrangements, ranked by weighted score (integer ranking, per the engine), each as student-to-desk assignments plus score and per-rule outcomes. If fewer than 3 distinct arrangements exist, it returns those that exist. | P0 | Distinct means differing in at least one student-to-desk assignment, across the whole run, not only the final population |
| FR-20 | For each arrangement the result includes, per rule, an outcome. Front has three states (Met, Neutral, Not met); not near and Isle have two (Met, Not met). Definitions are in section 9 (D-1..D-3). | P0 | Confirmed by owner |
| FR-21 | Results are displayed visually on the teacher's own room layout: each desk shows its student's name. The teacher can switch between the 3 arrangements and see rank and score for each. | P0 | |
| FR-22 | The results view shows each rule's outcome for the selected arrangement, with violated rules visibly distinguished (not by color alone), and highlights the students/desks involved in a rule when the rule is selected. | P0 | |
| FR-23 | The teacher can return from results to the editor, change the room, students or rules, and run again. After inputs change, existing results stay on screen marked "Out of date" and show student names as of the run. Renaming a student alone does not mark results out of date; removing a student does. | P0 | |
| FR-24 | Within a session, a run with the same layout, students, rules and seed gives identical results; the MVP does not expose the seed. Retyping the same roster may give different results, because student ids are generated. | P0 | Determinism kept from CLI invariants |
| FR-25 | If the service fails or is unreachable, the app shows a plain-language error, keeps all teacher input, and allows retry. | P0 | |
| FR-26 | The front end communicates with the GA only through a service layer; no GA logic runs in the front end. | P0 | Owner constraint |
| FR-27 | The GA domain remains behavior-compatible with the Go CLI engine for its existing rules (bugs-fixed scoring, integer scores, negative scores allowed, legacy proximity scoring default); the CLI must not regress. | P0 | Raised from P1: guards the whole engine |
| FR-28 | Results are read-only: the teacher cannot edit an arrangement in the results view. | P2 | Manual tweaking of results is Future |
| FR-29 | Fill room: in one step the teacher places a rectangle of desks (columns x rows, optional centre aisle), with the resulting count previewed and a warning if existing desks would be replaced. It respects the 50-desk cap and is undoable. | P1 | |
| FR-30 | Paste a list: the teacher pastes one name per line, sees a preview with duplicates flagged, and adds them. Names beyond the 50 limit or already in the class are shown and skipped, never silently dropped. | P1 | |
| FR-31 | Undo and redo for room, students and rules within a session, including removals. | P1 | Session only; no persistence |
| FR-32 | The teacher can cancel a run in progress. The editor unlocks, and a late response is discarded if the service cannot abort. | P1 | |
| FR-33 | When the room or students have any content, the app warns before the browser page is left or refreshed, and offers a "Start over" action. Nothing is saved between sessions. | P1 | Autosave is out of scope |
| FR-34 | "Show differences from Option 1": on options 2 and 3, desks whose student differs from Option 1 are marked, with a count. | P2 | Cut freely |
| FR-35 | Each rule outcome includes a reason supplied by the service (never computed in the browser): distance in desks for not near, row position for front, column position for Isle. The UI uses it for plain-language text such as "Maya sits 1 desk from Leo". | P0 | Resolves B-3 |
| FR-36 | The results show "N of M rules met" as the main indicator. The score is secondary, labeled "Score (higher is better)", shown as a signed number (it may be negative). | P0 | Neutral front outcomes count as not met in the N total (see D-1) |
| FR-37 | When no arrangement satisfies every rule, the results say so and name the option that breaks the fewest. | P1 | Best effort; no up-front impossibility check |

## 5. Non-Functional Requirements

- **Performance:** a run for 50 students on a grid up to 15 x 15 returns with p95 <= 5 s (proposed; confirmed after the architect's first measurement). Drag and drop remains responsive (no perceptible lag) with 50 desks.
- **Platform:** current desktop browsers on laptop/desktop. Mobile and touch are out of scope.
- **Privacy:** MVP uses no real PII (test names only); student names may appear in logs. Before any real release, names must be kept out of logs (obfuscated/ids). Tracked as a release gate. Nothing is stored in the browser between sessions in the MVP.
- **Reliability:** failed runs never lose teacher input (FR-25).
- **Accessibility:** defined by UX (WCAG 2.2 AA). The MVP must not rely on color alone to show outcomes.
- **Determinism:** per FR-24.
- **NFR-1 Operability (P0 for the build):** the development, test and production-like environments each run under Docker Compose from a clean checkout, with Docker as the only prerequisite; no host language toolchain (Go or Node) is required. The existing Go gate (`go vet`, `go test`, `gofmt` clean) and the web checks run through Compose, and the exit code is the pass/fail result. The production-like environment serves the app and the service together on one address. Runtime containers are stateless and run as non-root users. The service reports health, and logs go to standard output, not files. Images are built locally; publishing to a registry is not part of the MVP.
- **NFR-2 Supported versions:** every language, runtime and base image used must be within its vendor's supported (not end-of-life) window when chosen, and versions are pinned, not floating. `architecture.md` section 9 records the pinned versions and end-of-life dates; this PRD names no specific versions.

## 6. Scope

### In scope (MVP)
Grid room editor (max 15 x 15, 50-desk cap) with snap-to-grid drag and drop for desks and marker tokens; Fill room; student entry by name (max 50, unique, trimmed) and Paste a list; form-style rules editor (front, not near, Isle); session Undo/Redo; Run with busy indicator and Cancel; top 3 arrangements shown visually with "N of M rules met", score, per-rule outcomes with reasons; stale-results marking; leave-page warning and Start over; GA behind a service layer; 1:1 student-to-desk; no tuning; Docker Compose environments (development, test, production-like) per NFR-1.

### Out of scope / Future
- Saving/reopening classrooms, including autosave to the browser: next phase.
- Printing and export: next phase.
- Mobile/tablet: future.
- Text rule language (DSL): too complex for end users now.
- Free-form (non-grid) placement: grid first.
- Fewer/more students than desks: 1:1 only for MVP.
- GA tuning (population, generations, rates, selection, seed): no controls in MVP.
- New rule types, door-distance rules, rules affected by doors, side/back markers or teacher's desk: not in MVP.
- Accounts, sharing, multi-teacher: not needed.
- Manual editing of results: future.
- Allowing desks greater than students: future.
- Publishing images to a registry, CI provider choice and hosting (A-5): not decided.

## 7. Dependencies & Constraints

- Depends on the Go `seating` engine (`docs/dsseating-port/`). The architect has found the engine can accept arbitrary seats, so the work is a new adapter; the CLI must not regress (FR-27).
- Docker with Compose is the required tooling for building, testing and running the project; a host Go or Node install is neither needed nor used (NFR-1).
- Front end is React/TypeScript. The GA is a bounded domain behind a service layer (owner decision). Mechanism is the architect's call.
- Preserve the existing CLI behavior and the Go-port decisions (D1-D18) unless the owner changes them.

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GA quality or run time at 50 students is poor | Medium | High | Measure early on realistic 50-student rooms; confirm the 5 s target |
| Riskiest assumption: teachers find the top 3 usable for real staging | Medium | High | Validate with sample teachers before the next phase |
| Rule definitions give surprising results on irregular rooms (gaps, uneven rows) | Medium | Medium | Definitions D-1..D-3 tested on irregular rooms with independent recomputation |
| "Isle" is unclear to teachers | Low | Low | UX plain-language gloss |
| Loss of work on refresh (no autosave) | Medium | Medium | Leave-page warning, Undo (FR-33, FR-31); revisit saving in next phase |
| Real PII reaches logs after MVP | Low | High | Release gate in section 5 |

## 9. Open Questions & Assumptions

Decisions (owner confirmed):
- **D-1 Front:** rows are counted from the front-most desk row. The legacy score curve (+10, +7, 0, -7, -10) is stretched over the number of rows. Met if the student's row score is above 0; Neutral if exactly 0; Not met if below 0. In a 5-row room: rows 1-2 Met, row 3 Neutral, rows 4-5 Not met.
- **D-2 Not near:** distance is counted in desk steps (row steps plus column steps, gaps count). Met only if the two students are more than 2 steps apart. Two desks two apart in a row, or diagonal neighbours, count as near (legacy rule).
- **D-3 Isle:** Met when the student sits in the leftmost or rightmost occupied column of the room (legacy rule).
- **D-4 Markers:** cell tokens; the front marker is on a non-corner edge cell and defines the front edge on any of the four edges. Doors, teacher's desk, back and side are drawn only and do not affect scoring.
- **D-5 Limits:** grid max 15 x 15, 50 desks, 50 students, run-time target p95 <= 5 s proposed.
- **D-6 Other confirmed:** empty cells allowed; top 3 = three best distinct arrangements; MVP uses test data only and names in logs are acceptable; same input + seed gives identical results; best effort when rules are unsatisfiable; autosave out of MVP.

Closed: A-1, A-1b, A-2, A-3 (names unique), A-6, A-7, A-8.

- **Open (A-4):** run-time target is proposed (p95 <= 5 s); owner confirms after the architect's measurement.
- **Open (A-5):** hosting of the service (local-only, owner-hosted, or both) — architect proposes; does not block the build.
- **Assumed (owner approved the wording):** images are built locally and not published to a registry in the MVP; hosting (A-5) remains open.
- **Assumed (not confirmed):** the same 15 x 15 grid limit and 50-desk cap apply in client and server with identical messages.

## 10. Release & Rollout

Single MVP phase with test data only. Next phase: saving/reopening, printing/export. Real-PII release is gated on the privacy item in section 5.
