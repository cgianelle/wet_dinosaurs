# PRD: DSSeating Web (visual classroom seating)

**Status:** Draft
**Author:** product-manager agent (owner decisions relayed 2026-11-21)
**Last updated:** 2026-11-22
**Slug:** dsseating-web

**Revision note (round 2):** Owner approved the delta from the UX/architecture/check review (B-1, B-2, B-3, W-1, W-6 and PRD-1..15, P-1..P-10). Markers are cell tokens; grid max 15 x 15; 50-desk cap everywhere; "satisfied" definitions confirmed; Fill room, Paste a list, Undo/Redo and Cancel run are in the MVP as P1; autosave stays out. New FRs FR-29..FR-37. FR IDs are stable and none were renumbered. Status stays Draft.

**Revision note (round 3):** Owner added a Docker requirement: NFR-1 (Operability, Docker Compose environments) and NFR-2 (supported, pinned versions), with matching scope, constraint and assumption lines. No FR changed.

**Revision note (round 4):** Owner feedback on the layout tool: room features (front, back, sides, door) should read like the "Front of room" wall bar, not like cell-sized tiles mixed in with desks. Owner confirmed: (1) this supersedes the cell-token decision (PRD-2, D-4, ux.md S1); the grid now holds only desks, empty cells and the teacher's desk; (2) the front wall defaults to top and is changeable; (3) Back and Side walls are derived and labelled automatically; (4) a door is an opening in a wall; the teacher's desk is a desk-style cell inside the room. FR-5, FR-6, FR-16, FR-23 and D-4 are amended; FR-38 is new. No FR renumbered. Status stays Draft.

**Revision note (round 5):** Resolves check-report W-2. D-1 and D-3 are now front-relative for all four front walls (axis and numbering stated); "row" and "column" are defined once in the grid terms; FR-35 reason numbering follows D-1/D-3; the teacher's desk is excluded from occupied rows and columns (G-5); tests cover all four front walls. No FR added, changed in meaning or renumbered. Status stays Draft.

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

Grid terms: the room is an N x Y grid of cells. A cell is a desk, empty, or the teacher's desk. The four room walls are drawn as bands around the grid edge and are not cells. "Desk count" is the number of student desk cells (the teacher's desk is not counted). In D-1..D-3 and FR-35, "row" and "column" are front-relative, never the screen axes: a row is a line of desks parallel to the front wall, a column is a line perpendicular to it. The teacher's desk is not a student desk and never makes a row or column "occupied".

| ID | Requirement | Priority | Notes |
|----|-------------|----------|-------|
| FR-1 | The teacher can set the room grid size (N columns by Y rows). Minimum 1 x 1, maximum 15 columns x 15 rows, default 8 x 6. | P0 | Server enforces the same limit; the client must never allow more than the server accepts |
| FR-2 | The teacher can add a desk to the grid by dragging it to a cell, with snap-to-grid placement. The room holds at most 50 desks; adding a desk beyond 50 is refused with a clear message ("Room is full (50 desks)"). | P0 | The cap applies to every way of adding desks (drag, click-to-place, paint-drag, Fill room) |
| FR-3 | The teacher can move a placed desk to another empty cell by drag and drop, with snap-to-grid. | P0 | Dropping on an occupied cell is rejected with the desk returning to its origin |
| FR-4 | The teacher can remove a desk from the grid. | P0 | |
| FR-5 | Room features are shown as walls, in the style of the front wall bar, not as cell tiles. The room has four wall bands around the grid. The front wall is set per FR-6. The back wall (opposite the front) and the two side walls are labelled automatically; the teacher does not place them. The teacher can add up to 3 doors, each an opening in any wall at a cell-aligned position, and can move or remove them (drag with snap, with a click-to-place and keyboard alternative). The teacher can place 1 teacher's desk as a desk-style cell inside the grid; it holds no student, does not count toward desk count or the 50-desk cap, and is visual only. | P0 | Supersedes cell-token markers (round 4). Walls and doors are not grid cells. The GA ignores everything except the front wall. Resolves A-2, A-7 |
| FR-6 | The room always has exactly one front wall, one of top, bottom, left or right. It defaults to top and the teacher can change it (click a wall or use a "Front wall" control). It is the front edge the GA uses. | P0 | Replaces the front marker; no corner or non-corner rule, no missing-front state. Back, side, doors and teacher's desk are visual only |
| FR-7 | The teacher can add a student by name. Names are trimmed on entry and otherwise shown exactly as entered (no conversion to labels in the UI). Empty names are rejected; maximum length is 40 characters. | P0 | |
| FR-8 | The teacher can edit and remove a student. Removing a student removes that student's rules. | P0 | |
| FR-9 | The app rejects more than 50 students, with a clear message. | P0 | |
| FR-10 | Student names must be unique within a class. Uniqueness is checked after trimming, case-insensitively and ignoring Unicode normalization differences, with a clear message on a duplicate. | P0 | |
| FR-11 | The teacher can add a "front" rule for a student via a form (student should sit near the front). | P0 | Legacy front-row scoring semantics |
| FR-12 | The teacher can add a "not near" rule for a pair of two different students via a form. | P0 | Legacy proximity semantics (default legacy scoring) |
| FR-13 | The teacher can add an "Isle" rule for a student via a form (student must sit in the outside columns). | P0 | UI spelling "Isle"; UX may add a plain-language gloss |
| FR-14 | The teacher can view, edit and delete rules in a list. | P0 | |
| FR-15 | The app blocks and explains: duplicate rules (including a not-near pair in reverse order), a not-near rule pairing a student with themselves, rules naming a student that no longer exists. | P0 | Matches CLI strictness (no rule scored twice) |
| FR-16 | Run is enabled only when: student count equals desk count, there is at least 1 student, and there are no rule errors. Otherwise the app states precisely what blocks it, and for a count mismatch says how to fix it (for example "Add 2 students or remove 2 desks"). | P0 | 1:1 student-to-desk ratio is an MVP rule |
| FR-17 | Clicking Run sends the room layout, students and rules to the GA service and shows a busy indicator while waiting; the teacher cannot start a second run concurrently. | P0 | The engine reports no progress, so no progress bar |
| FR-18 | The GA domain accepts a room defined as a set of desk positions on a grid with a front edge, up to 50 desks, and up to 50 students identified by opaque ids. | P0 | WHAT only; engine today supports only 20 students (A-T) on a 5x4 grid |
| FR-19 | The GA domain returns the top 3 distinct arrangements, ranked by weighted score (integer ranking, per the engine), each as student-to-desk assignments plus score and per-rule outcomes. If fewer than 3 distinct arrangements exist, it returns those that exist. | P0 | Distinct means differing in at least one student-to-desk assignment, across the whole run, not only the final population |
| FR-20 | For each arrangement the result includes, per rule, an outcome. Front has three states (Met, Neutral, Not met); not near and Isle have two (Met, Not met). Definitions are in section 9 (D-1..D-3). | P0 | Confirmed by owner |
| FR-21 | Results are displayed visually on the teacher's own room layout: each desk shows its student's name. The teacher can switch between the 3 arrangements and see rank and score for each. | P0 | |
| FR-22 | The results view shows each rule's outcome for the selected arrangement, with violated rules visibly distinguished (not by color alone), and highlights the students/desks involved in a rule when the rule is selected. | P0 | |
| FR-23 | The teacher can return from results to the editor, change the room, students or rules, and run again. After inputs change, existing results stay on screen marked "Out of date" and show student names as of the run. Renaming a student alone does not mark results out of date; removing a student does. Changing the front wall marks results out of date. | P0 | Moving a door or the teacher's desk does not |
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
| FR-35 | Each rule outcome includes a reason supplied by the service (never computed in the browser): distance in desks for not near, row position for front, column position for Isle. The UI uses it for plain-language text such as "Maya sits 1 desk from Leo". | P0 | Resolves B-3. Positions are front-relative and use D-1/D-3 numbering ("row N of M" counts desk rows from the front wall; "column N of M" counts occupied columns along the front wall's axis). This can differ from the grid index in a desk's accessible name when rows are empty |
| FR-36 | The results show "N of M rules met" as the main indicator. The score is secondary, labeled "Score (higher is better)", shown as a signed number (it may be negative). | P0 | Neutral front outcomes count as not met in the N total (see D-1) |
| FR-38 | Wall features are visually distinct from desks and from each other. Each wall is labelled (Front, Back, Side) and each door is labelled, by text or icon, never by color alone. The wall labels rotate when the front wall changes. | P0 | Builds on the accessibility NFR; UX decides the look |
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
Grid room editor (max 15 x 15, 50-desk cap) with snap-to-grid drag and drop for desks and the teacher's desk, a front wall chosen from four, derived back and side walls, and doors as wall openings; Fill room; student entry by name (max 50, unique, trimmed) and Paste a list; form-style rules editor (front, not near, Isle); session Undo/Redo; Run with busy indicator and Cancel; top 3 arrangements shown visually with "N of M rules met", score, per-rule outcomes with reasons; stale-results marking; leave-page warning and Start over; GA behind a service layer; 1:1 student-to-desk; no tuning; Docker Compose environments (development, test, production-like) per NFR-1.

### Out of scope / Future
- Saving/reopening classrooms, including autosave to the browser: next phase.
- Printing and export: next phase.
- Mobile/tablet: future.
- Text rule language (DSL): too complex for end users now.
- Free-form (non-grid) placement: grid first.
- Fewer/more students than desks: 1:1 only for MVP.
- GA tuning (population, generations, rates, selection, seed): no controls in MVP.
- New rule types, door-distance rules, rules affected by doors, side/back walls or teacher's desk: not in MVP.
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
| Rule definitions give surprising results on irregular rooms (gaps, uneven rows) | Medium | Medium | Definitions D-1..D-3 tested on irregular rooms and for all four front walls, with independent recomputation |
| "Isle" is unclear to teachers | Low | Low | UX plain-language gloss |
| Loss of work on refresh (no autosave) | Medium | Medium | Leave-page warning, Undo (FR-33, FR-31); revisit saving in next phase |
| Real PII reaches logs after MVP | Low | High | Release gate in section 5 |

## 9. Open Questions & Assumptions

Decisions (owner confirmed):
- **D-1 Front (amended round 5):** rows are lines of desks parallel to the front wall, counted outward from it, so they follow the front wall rather than the screen. Top front: screen rows, top to bottom. Bottom front: screen rows, bottom to top. Left front: screen columns, left to right. Right front: screen columns, right to left. Row 1 is the front-most row that holds at least one desk; rows with no desk are not counted. The legacy score curve (+10, +7, 0, -7, -10) is stretched over the number of desk rows. Met if the student's row score is above 0; Neutral if exactly 0; Not met if below 0. In a room with 5 desk rows: rows 1-2 Met, row 3 Neutral, rows 4-5 Not met.
- **D-2 Not near:** distance is counted in desk steps (row steps plus column steps, gaps count). Met only if the two students are more than 2 steps apart. Two desks two apart in a row, or diagonal neighbours, count as near (legacy rule).
- **D-3 Isle (amended round 5):** an outside column is one of the two extreme occupied lines of desks perpendicular to the front wall, i.e. the lines nearest the two side walls. Met when the student sits in either of them (legacy rule). It is symmetric, so handedness does not matter. Top or bottom front: the leftmost or rightmost occupied screen column. Left or right front: the topmost or bottommost occupied screen row. Changing the front wall does not move desks; only the scoring axis changes.
- **D-4 Room features (amended round 4):** walls, not cell tokens. The front wall (default top, any of four) defines the front edge. Back and side walls are derived labels. Doors are wall openings. The teacher's desk is a student-less desk-style cell. All except the front wall are drawn only and do not affect scoring.
- **D-5 Limits:** grid max 15 x 15, 50 desks, 50 students, run-time target p95 <= 5 s proposed.
- **D-6 Other confirmed:** empty cells allowed; top 3 = three best distinct arrangements; MVP uses test data only and names in logs are acceptable; same input + seed gives identical results; best effort when rules are unsatisfiable; autosave out of MVP.

Closed: A-1, A-1b, A-2, A-3 (names unique), A-6, A-7, A-8.

- **Assumed (round 4, not confirmed):** the teacher's desk remains a separate, student-less cell (limit 1, visual only, not counted toward desk count). If the owner instead wants it to be an ordinary student desk, it would count toward the desk count and take a student, and the item should be dropped.
- **Assumed (round 4):** doors are cell-aligned openings, up to 3, any wall, several may share a wall.
- **Open (A-4):** run-time target is proposed (p95 <= 5 s); owner confirms after the architect's measurement.
- **Open (A-5):** hosting of the service (local-only, owner-hosted, or both) — architect proposes; does not block the build.
- **Assumed (owner approved the wording):** images are built locally and not published to a registry in the MVP; hosting (A-5) remains open.
- **Assumed (not confirmed):** the same 15 x 15 grid limit and 50-desk cap apply in client and server with identical messages.

## 10. Release & Rollout

Single MVP phase with test data only. Next phase: saving/reopening, printing/export. Real-PII release is gated on the privacy item in section 5.
