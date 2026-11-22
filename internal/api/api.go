// Package api is the HTTP shell around the solver facade: POST /v1/solve, GET /healthz and,
// optionally, the built web app (AD-5, AD-8, AD-12). It holds no state between requests.
package api

import (
	"context"
	"log/slog"
	"net/http"
	"runtime"
	"time"

	"dsseating/solver"
)

const (
	defaultTimeout = 30 * time.Second
	maxBodyBytes   = 256 << 10
)

// SolveFunc runs one request; solver.Solve in production, a stub in tests.
type SolveFunc func(context.Context, solver.Request, solver.Options) (solver.Response, error)

// Config holds the server's tunables. Zero values select the production defaults.
type Config struct {
	StaticDir   string        // directory of built web assets; empty serves the API only
	Timeout     time.Duration // per-run limit; default 30 s
	MaxInFlight int           // concurrent runs; default runtime.NumCPU()
	Logger      *slog.Logger  // default slog.Default()
	Solve       SolveFunc     // default solver.Solve
}

type server struct {
	solve   SolveFunc
	timeout time.Duration
	slots   chan struct{}
}

// New returns the handler for the whole service.
func New(cfg Config) http.Handler {
	s := &server{solve: cfg.Solve, timeout: cfg.Timeout, slots: make(chan struct{}, max(cfg.MaxInFlight, 0))}
	if s.solve == nil {
		s.solve = solver.Solve
	}
	if s.timeout == 0 {
		s.timeout = defaultTimeout
	}
	if cap(s.slots) == 0 {
		s.slots = make(chan struct{}, runtime.NumCPU())
	}
	logger := cfg.Logger
	if logger == nil {
		logger = slog.Default()
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/solve", s.handleSolve)
	mux.HandleFunc("/healthz", handleHealth)
	if cfg.StaticDir != "" {
		mux.Handle("/", http.FileServer(http.Dir(cfg.StaticDir)))
	}
	return withRequestLog(logger, mux)
}

// ListenAndServe serves handler on addr until the listener fails.
func ListenAndServe(addr string, handler http.Handler) error {
	server := &http.Server{Addr: addr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	return server.ListenAndServe()
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok"))
}
