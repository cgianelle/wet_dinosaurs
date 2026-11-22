package api

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"dsseating/solver"
)

// logEntry is what one request line may say: counts and a code, never ids, names, bodies or
// coordinates (AD-12).
type logEntry struct {
	status                               int
	code                                 solver.Code
	desks, students, rules, arrangements int
}

type logEntryKey struct{}

func logEntryOf(r *http.Request) *logEntry {
	entry, _ := r.Context().Value(logEntryKey{}).(*logEntry)
	if entry == nil {
		entry = &logEntry{}
	}
	return entry
}

func (e *logEntry) refuse(w http.ResponseWriter, status int, refusal *solver.Error) {
	e.status, e.code = status, refusal.Code
	writeError(w, status, refusal)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

func withRequestLog(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		entry := &logEntry{}
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(recorder, r.WithContext(context.WithValue(r.Context(), logEntryKey{}, entry)))
		status := recorder.status
		if entry.status != 0 {
			status = entry.status
		}
		attrs := []any{"method", r.Method, "path", r.URL.Path, "status", status, "duration", time.Since(start)}
		if r.URL.Path == "/v1/solve" {
			attrs = append(attrs, "desks", entry.desks, "students", entry.students, "rules", entry.rules,
				"arrangements", entry.arrangements, "error", string(entry.code))
		}
		logger.Info("request", attrs...)
	})
}
