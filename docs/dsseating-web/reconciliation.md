# Reconciliation log: Classroom seating web app

**Slug:** dsseating-web
**Last updated:** 2026-11-22
**Sources:**
- PRD: docs/dsseating-web/prd.md
- UX: docs/dsseating-web/ux.md
- Architecture: docs/dsseating-web/architecture.md
- Check report: docs/dsseating-web/check-report.md

## Entries

### W-7

- **Status:** agreed
- **Conflict:** The architecture's client error union (`ok | rejected(code) | unreachable | timeout | busy | internal`, section 8 "Errors") has two members with no clean UX variant, and the two docs treat a rejected request differently. `busy` (503, AD-8 concurrency cap) has no copy in UX S6, which lists only unreachable, timeout, "service rejected the input" and unexpected. UX S6 also specifies a "service rejected the input" banner with a plain-words service reason and a fix link, while AD-10 says a server 400 after the client allowed Run is an internal defect shown as a generic error, and AD-5 says the response `message` is developer-only and a server `limit_exceeded` reuses the shared limit messages.
- **Proposal:** Keep the UX banner pattern and drop the separate "service rejected the input" variant, because the client validates every predicate the server does (AD-10), so a 400 is never a user path and a reason table plus fix link would be dead code. One mapping, every union member to exactly one S6 variant:
  - `unreachable` -> Unreachable/offline variant (unchanged copy).
  - `timeout` -> Timeout variant (unchanged copy).
  - `busy` -> new variant, same pattern with Try again: "The seating service is busy right now. Try again in a moment." (UX to finalize wording.)
  - `rejected(code)` with any code other than `limit_exceeded`, and `internal` -> Unexpected variant ("Something went wrong on our side. Try again."), with the `code` (and `field` if present) shown only under "Show details".
  - `rejected(limit_exceeded)` -> Unexpected variant whose first sentence is the shared message from `limits.ts` for its `field` (for example "Room is full (50 desks)."); also unreachable from the UI in practice, so no extra layout.
  Changes: ux.md S6 deletes the "Service rejected the input" bullet and adds the `busy` bullet; architecture.md AD-10 last sentence and section 8 "Errors" row state this mapping, and AD-5's `message` rule stays developer-only. No change to the wire contract, no PRD change (FR-25 holds: input is kept, Try again re-sends the same snapshot).
- **Reply:** accept
- **Outcome:** Agreed as proposed. Every client error-union member maps to exactly one S6 banner variant, all with Try again re-sending the same snapshot and input kept (FR-25): `unreachable` -> Unreachable/offline; `timeout` -> Timeout; `busy` -> new Busy variant with copy "The seating service is busy right now. Try again in a moment."; `internal` and `rejected(code)` for any code other than `limit_exceeded` -> Unexpected ("Something went wrong on our side. Try again."), `code` and `field` only under "Show details"; `rejected(limit_exceeded)` -> Unexpected with the shared `limits.ts` message for its `field` as first sentence. The S6 "Service rejected the input" variant and its fix link are removed. Wire contract and PRD unchanged.
- **History:**
  - round 1: first proposal.
  - round 1: UX accepts; Busy copy finalized as written in Outcome.
