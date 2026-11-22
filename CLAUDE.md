@AGENTS.md

## Claude Code notes

- `AGENTS.md` is the source of truth; put shared guidance there, not here.
- Before finishing any code change, run `go vet ./... && go test ./...` and `gofmt -l .` (must print nothing).
- Spec docs in `docs/dsseating-port/` are updated in place; don't create `-vN` copies.
- This folder is not a git repository yet; don't assume branches or history exist.
