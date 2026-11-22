# Routing: dsseating-web

Decision record for which feature-graph nodes run. Written by `scripts/kev_route.py`. The orchestrator changes only the **Final** section, and only through `kev_route.py --set`. Do not hand-edit the `kev-route` comments: the script and the checker read them.

**Last routed:** 2026-11-21 16:21
**PRD:** `docs/dsseating-web/prd.md`
**Source:** kev — `http://127.0.0.1:1234`, model `kev-9b`, 7850 ms

## Kev answers

| Question | Type | Result | Probabilities |
|----------|------|--------|---------------|
| `needs_ux` | noul | P(yes)=0.93 | — |
| `needs_architecture` | noul | P(yes)=0.94 | — |
| `change_size` | score | 2.62 (conf 0.62) | 0: 0.02, 1: 0.04, 2: 0.26, 3: 0.69 |

Thresholds: run if P ≥ 0.80, skip if P ≤ 0.20, otherwise ask. Fast path: yes if P(trivial) ≥ 0.80 and both specs skip; ask if P(trivial) ≥ 0.50; otherwise no.

## Recommendation

| Node | Recommended | Why |
|------|-------------|-----|
| ux-designer | run | P=0.93 ≥ 0.80 |
| architect | run | P=0.94 ≥ 0.80 |
| fast path | no | a spec is needed |

<!-- kev-route recommended ux=run arch=run fast=no source=kev -->

## Final

Set at Gate 1 (and again at Gate 1b). `pending` means the gate has not decided yet. Nothing downstream of Gate 1 runs on `pending`.

<!-- final:start -->
| Node | Final | Set by |
|------|-------|--------|
| ux-designer | run | Gate 1b: user (Docker NFR) |
| architect | run | Gate 1b: user (Docker NFR) |
| fast path | no | Gate 1b: user (Docker NFR) |

<!-- kev-route final ux=run arch=run fast=no -->
<!-- final:end -->

## Decision log

<!-- log:start -->
- 2026-11-21 15:08 routed (source=kev): ux=run arch=run fast=no
- 2026-11-21 15:26 final set by Gate 1: user: ux=run arch=run fast=no
- 2026-11-21 15:57 routed (source=kev): ux=run arch=run fast=no
- 2026-11-21 15:57 final set by Gate 1b: user: ux=run arch=run fast=no
- 2026-11-21 16:21 routed (source=kev): ux=run arch=run fast=no
- 2026-11-21 16:21 final set by Gate 1b: user (Docker NFR): ux=run arch=run fast=no
<!-- log:end -->
