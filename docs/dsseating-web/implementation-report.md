# Implementation report: DSSeating Web

**Status:** PASS
**Last updated:** 2026-11-21
**Sources:**
- Build package: docs/dsseating-web/build-package.md
- UX: docs/dsseating-web/ux.md
- Architecture: docs/dsseating-web/architecture.md
- Files reviewed: docker-compose.yml, Dockerfile, .dockerignore, web/Dockerfile, README.md, AGENTS.md, solver/, internal/api/, cmd/dsseating-server/main.go, internal/archtest/imports_test.go, contract/fixtures/, web/ config and web/src/{model,state,solver,ui}

## Verdict

| Blocking | Warnings | Notes |
|----------|----------|-------|
| 0 | 0 | 4 |

## 1. Sound

Structure follows AD-1/AD-9: pure `model` and `state`, `fetch` only in `web/src/solver/` (enforced by `fetch-boundary.test.ts`), pure Go `solver` facade, thin `internal/api`. No TODO/FIXME, `ts-ignore`, `eslint-disable` or `as any` found. Largest source file is 381 lines (`RoomCanvas.tsx`), acceptable. `seating/`, `report/`, `internal/cli/`, `cmd/dsseating/` have no file newer than the PRD (untouched; no VCS to prove it, and their tests pass).

| ID | Severity | Owner | Finding | Resolution needed |
|----|----------|-------|---------|-------------------|
| S-1 | Note | clean-code | `RoomCanvas.tsx` (381 lines) mixes keyboard handling, drop validation wiring and rendering (G30/SRP). | Optional split of the key handler into its own module. |

## 2. Spec met

| ID | Source | Status | Gap |
|----|--------|--------|-----|
| FR-1..FR-5 | S1, AD-9 | met | classroom/geometry tests; size bar, palette |
| FR-6 | AD-10, AD-11 | met | Front placement rejection covered in `App.test.tsx` |
| FR-7..FR-15 | S2, S3 | met | duplicate/inline-message tests |
| FR-16, FR-17 | S4, AD-8, AD-10 | met | blockers test, run state machine |
| FR-18..FR-20, FR-35, FR-36 | AD-2, AD-3, AD-5, AD-7 | met | solver oracle (brute-force recomputation), drift-guard fixtures |
| FR-21, FR-22, FR-37 | S5 | met | "N of M rules met", FR-37 banner, reason line tested |
| FR-23 | S6, AD-11 | met | Out of date after edit, not after rename (tested) |
| FR-24 | AD-6 | met | determinism test, order-independence |
| FR-25 | S6, AD-8 | met | service-failure retry test |
| FR-26, FR-27 | AD-1 | met | archtest + fetch boundary |
| FR-29..FR-33 | P1 | met | Fill room, Paste, Undo/Redo, Cancel, Start over, beforeunload all present in code |
| NFR-1 | AD-12, AD-13 | met | verified: prod profile started, `/healthz` ok, `/` 200, container healthy, uid 10001; read_only, cap_drop, no-new-privileges, json-file rotation present |
| NFR-2 | section 9 | met | all pins exact, `.npmrc` save-exact, TS 7 + TS 6 aliases, Docker tags exact |
| A11y | ux.md section 10 | met (tests limited) | reduced motion, 44px targets, aria-live, color scheme, keyboard pick-up/drop via custom handler (UX allows it) |
| Ubiquitous language | build package | met | "Isle", "student", Met/Neutral/Not met used; no silent synonyms seen |

## 3. Tests and coverage

- Test commands run:
  - Host: `go vet ./... && go test ./...` and `gofmt -l .`: pass, gofmt prints nothing.
  - `docker compose --profile test run --rm go-test`: pass (exit 0).
  - `docker compose --profile test run --rm web-test` (`tsc`, `tsc6`, eslint, vitest, vite build): pass; 10 files, 141 tests; build 405 kB.
  - `go test -cover ./solver ./internal/api`: 97.8% and 88.6%.
- Result: pass
- New/changed code covered: yes for Go (coverage tool) and by behavior tests for web; no web coverage tool configured.

| ID | Severity | Finding | Resolution needed |
|----|----------|---------|-------------------|
| T-1 | Note | No JS coverage tool; UI covered by 11 behavior tests plus model/state tests. | Optional `vitest --coverage` later. |
| T-2 | Note | `cmd/dsseating-server` has no tests (thin shim; imports enforced by archtest). | None. |

## Issues

### Blockers

None.

### Warnings

None.

### Notes

1. S-1: `RoomCanvas.tsx` could be split.
2. T-1: no web coverage tooling.
3. T-2: server `main.go` untested, covered indirectly by the prod-profile smoke run.
4. Keyboard drag is a custom roving handler (no dnd-kit KeyboardSensor); permitted by ux.md section 12, and a keyboard move test exists. The screen-reader smoke test in ux.md section 10 was not run by this check.
