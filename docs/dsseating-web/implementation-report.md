# Implementation report: DSSeating Web (visual classroom seating)

**Status:** PASS
**Last updated:** 2026-11-22
**Sources:**
- Build package: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/build-package.md
- UX: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/ux.md
- Architecture: /Users/cgianelle/Projects/dsseating-port/docs/dsseating-web/architecture.md
- Files reviewed (this round): web/src/ui/canvasCommands.ts, canvasCommands.test.ts, PlanView.tsx, RoomCanvas.tsx; earlier files re-run through the full gates (Go `solver`, `internal/api`, contract fixtures, web model/state/solver/ui).

## Verdict

**PASS** if blocking = 0 **and** warnings = 0. Notes do not fail.

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 0 | 0 | 4 |

## 1. Sound

Drag/drop and click/keyboard command mapping now lives in the pure `canvasCommands.ts` (one place for place/move/remove/drop outcomes); `RoomCanvas` and `PlanView` consume it. Functions are small, intention-revealing and side-effect free; `PlanView` and `RoomCanvas` stay under 300 lines. No GA logic, scores or fetch in the UI (AD-1 respected).

| ID | Severity | Owner | Finding | Resolution needed |
|----|----------|-------|---------|-------------------|
| S-1 | Note | clean-code | `ghostLabel` in `PlanView.tsx` repeats the item-name mapping already held by `ITEM_NAMES` in `canvasCommands.ts` (G5). | Reuse `ITEM_NAMES`. |
| S-2 | Note | clean-code | `dropOutcome` casts `id as Tool` without checking. A malformed `tool:<x>` id would reach `placementOf` and fall through to a teacher's-desk placement. Unreachable today (ids come only from `Palette`). (G4, G12) | Validate the tool name, as `asItem` does for items. |
| S-3 | Note | clean-code | `move` and `place` in `RoomCanvas.tsx` are the same "command or notify" shape (G5). | Extract one `apply(command \| string)` helper (it would also serve `onDragEnd` in `PlanView`). |
| S-4 | Note | clean-code | `canvasRef` in `PlanView.tsx` is attached but never read (G9). | Remove it. |

## 2. Spec met

| ID | Source | Status | Gap |
|----|--------|--------|-----|
| FR-1..FR-4 (grid, add by drag/click/paint/keyboard, move, remove, 50 cap) | build-package, S1, AD-9 | met | Placement, move and removal go through `canvasCommands`, paint stroke and keyboard pick-up/drop; covered by the `canvasCommands` and `App` tests. |
| FR-5, FR-6, FR-38 (wall ring, front wall, derived labels, doors, teacher's desk) | S1, S5, AD-9, AD-11 | met | Wall labels are text and band class, not color alone; "Make this the front wall" action present. |
| FR-7..FR-16 (students, rules, readiness) | S2, S3, S4, AD-10 | met | Run checklist with fix links in `PlanView`. |
| FR-17, FR-24, FR-25 (run, busy panel, Cancel, failure banner, Try again) | S4, S6, AD-8, W-7 | met | `busy` copy matches reconciliation W-7; Unexpected variant keeps code under "Show details". |
| FR-18..FR-23, FR-35, FR-36, FR-37 (results) | S5, AD-2, AD-3, AD-7, AD-11 | met | Solver facade and fixtures for all four front edges pass; read-only canvas highlights rule involvement. |
| FR-29..FR-33 (Fill room, Paste, Undo/Redo, Cancel, leave warning, Start over) | S1, S2, S4, S7 | met | Undo link after removals, `beforeunload` warning, Start over confirm dialog present. |
| A11y (composite tab stop, arrows over wall segments, click and keyboard equivalents to drag, live announcements) | S1, WCAG 2.2 AA | met | Keyboard pick-up/drop/cancel announced via `app.announce`. Screen-reader smoke test cannot be run in this environment. |
| Ubiquitous language (Room, Desk, Teacher's desk, Wall, Door, Isle) | build-package section 4 | met | No silent synonyms found in the touched files. |
| AD-13, NFR-1/2 (Docker Compose gates, pins) | build-package | met | `docker compose --profile test run --rm web-test` runs the full `check` chain (tsc, tsc6, eslint, vitest, vite build). |

## 3. Tests and coverage

- Test commands:
  - `go vet ./... && go test ./...` and `gofmt -l .`
  - `docker compose --profile test run --rm web-test`, which runs `tsc --noEmit && tsc6 --noEmit && eslint . && vitest run && vite build`
- Result: pass
  - Go: all packages ok, vet clean, `gofmt -l .` empty. Coverage: `solver` 97.9%, `internal/api` 88.6%.
  - Web: 11 files, 195 tests passed (`canvasCommands.test.ts` 16, `App.test.tsx` 24). tsc, tsc6 and eslint clean; vite build ok.
- New/changed code covered: yes. `canvasCommands.ts` is exercised branch by branch (place, move, remove, refusals with reasons, colon-bearing ids, unknown drags). The `RoomCanvas`/`PlanView` paths are exercised by `App.test.tsx`. No web coverage tool is configured, so no web percentage is reported.

| ID | Severity | Finding | Resolution needed |
|----|----------|---------|-------------------|
| T-1 | Note | No web coverage tool, and no test for a malformed `tool:` drag id (see S-2). | Optionally add after S-2. |

## Issues

### Blockers

None.

### Warnings

None.

### Notes

1. S-1: `ghostLabel` duplicates `ITEM_NAMES`.
2. S-2: unchecked `id as Tool` cast in `dropOutcome`.
3. S-3: duplicated "command or notify" handling in `RoomCanvas` `move` and `place`.
4. S-4: unused `canvasRef` in `PlanView`.
