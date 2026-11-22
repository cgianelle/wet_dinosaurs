# syntax=docker/dockerfile:1
# Go server image. Targets: dev, test, build, webbuild, runtime (AD-13).
# Build context is the repository root.

FROM golang:1.27.4-alpine3.24 AS gobase
ENV GOFLAGS=-buildvcs=false \
    CGO_ENABLED=0 \
    GOCACHE=/tmp/go-cache \
    GOPATH=/tmp/go \
    GOMODCACHE=/tmp/go/pkg/mod
WORKDIR /src

FROM gobase AS dev
USER 10001:10001
EXPOSE 8080
CMD ["go", "run", "./cmd/dsseating-server", "-addr", ":8080"]

FROM gobase AS test
COPY . .
RUN chown -R 10001:10001 /src
USER 10001:10001
CMD ["sh", "-c", "gofmt -l . | (! grep .) && go vet ./... && go test ./..."]

FROM gobase AS build
COPY . .
RUN --mount=type=cache,target=/tmp/go-cache \
    go build -trimpath -ldflags "-s -w" -o /out/dsseating-server ./cmd/dsseating-server

FROM node:26.13.1-alpine3.24 AS webbuild
WORKDIR /app/web
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY web/ ./
RUN npm run build

FROM alpine:3.24.4 AS runtime
COPY --from=build /out/dsseating-server /usr/local/bin/dsseating-server
COPY --from=webbuild /app/web/dist /srv/web
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["dsseating-server"]
CMD ["-addr", ":8080", "-static", "/srv/web"]
