# dsseating

A Go (standard library only) port of the DSSeating genetic algorithm. It seats 20 students (A-T)
in a 5x4 classroom using front-row, not-near and isle rules, with the legacy bugs fixed.

A web app (`web/`) lets a teacher draw a classroom, list students and rules, and see the top three
arrangements. It reaches the engine only through the Go service (`solver`, `internal/api`).

## Build and test

    go build ./cmd/dsseating
    go vet ./... && go test ./...
    go test -tags quality -run Quality -v ./seating   # strict-mode quality check (informational)

Sample tests read the Java reports from `$DSSEATING_SAMPLES` (default
`/Users/cgianelle/Projects/DSSeating_10_10_03`, read-only) and skip as "unverified" when absent.

## Use

    dsseating -frontrow A -frontrow D -proximity Q R -isle F -plague -pmx \
              -xoverrate 0.85 -mutrate 0.05 -killrate 75 -seed 42

Run `dsseating -h` for every option. Defaults: `-random` selection, `-cx` crossover.
The same `-seed` and options give byte-identical stdout and files (same Go version and OS).

## Output

51 files go to the `-out` directory (default `./out`): `Generation5050.txt` (the random starting
population), then `Generation0.txt` .. `Generation49.txt`. Files are not zero-padded, so `ls` sorts
them oddly. Each file has a `Best Individual:` block, a 49-underscore separator, then 100
`Individual:` blocks. The 20 letters of a chromosome are the students in seat order, row-major
(row 1 is the front). Line endings are LF; the legacy Java samples use CRLF.

## Web app (Docker Compose only; no host Go or Node needed)

    docker compose --profile dev up --build        # http://localhost:5173 (Vite) with the API on :8080
    docker compose --profile prod up --build       # http://localhost:8080, one binary serves API and app
    docker compose --profile test run --rm go-test # gofmt, go vet, go test
    docker compose --profile test run --rm web-test# tsc, tsc6, eslint, vitest, vite build
    docker compose --profile dev run --rm web npm install   # update web/package-lock.json

Ports are `APP_PORT`, `API_PORT`, `WEB_PORT` (compose variables). Specs: `docs/dsseating-web/`.
Contract fixtures in `contract/fixtures/` are shared by the Go and TypeScript tests; regenerate them
with `UPDATE_FIXTURES=1 go test ./solver -run TestWriteFixtures`.

## Layout

- `seating`: pure engine (layout, scoring, selection, crossover, mutation, `Run`)
- `report`: legacy text format and file names
- `internal/cli`: argv parsing, help, atomic file writing, exit codes
- `cmd/dsseating`: ten-line shim
- `solver`: pure facade from a room (desks, front edge, ids) to the engine; the wire contract
- `internal/api`: `POST /v1/solve`, `GET /healthz`, optional static files
- `cmd/dsseating-server`: server shim (`-addr`, `-static`)
- `web/`: React + TypeScript planner (`src/model`, `src/state`, `src/solver`, `src/ui`)
- `contract/fixtures`: shared request/response/error JSON
