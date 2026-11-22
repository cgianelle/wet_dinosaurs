package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"dsseating/solver"
)

// statusClientClosed is logged (never sent) when the caller disconnects mid-run.
const statusClientClosed = 499

var statusByCode = map[solver.Code]int{
	solver.CodeMalformedRequest: http.StatusBadRequest,
	solver.CodeLimitExceeded:    http.StatusBadRequest,
	solver.CodeCountMismatch:    http.StatusBadRequest,
	solver.CodeNoStudents:       http.StatusBadRequest,
	solver.CodeInvalidFrontEdge: http.StatusBadRequest,
	solver.CodeDesksOverlap:     http.StatusBadRequest,
	solver.CodeDeskOutOfGrid:    http.StatusBadRequest,
	solver.CodeDuplicateID:      http.StatusBadRequest,
	solver.CodeUnknownStudent:   http.StatusBadRequest,
	solver.CodeDuplicateRule:    http.StatusBadRequest,
	solver.CodeSelfPair:         http.StatusBadRequest,
	solver.CodeBusy:             http.StatusServiceUnavailable,
	solver.CodeTimeout:          http.StatusGatewayTimeout,
	solver.CodeInternal:         http.StatusInternalServerError,
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code  solver.Code `json:"code"`
	Field string      `json:"field,omitempty"`
	Limit int         `json:"limit,omitempty"`
}

func (s *server) handleSolve(w http.ResponseWriter, r *http.Request) {
	entry := logEntryOf(r)
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		entry.refuse(w, http.StatusMethodNotAllowed, &solver.Error{Code: solver.CodeMalformedRequest})
		return
	}
	req, refusal := decodeRequest(w, r)
	if refusal != nil {
		entry.refuse(w, statusByCode[refusal.Code], refusal)
		return
	}
	entry.desks, entry.students, entry.rules = len(req.Desks), len(req.Students), len(req.Rules)
	release, ok := s.acquire()
	if !ok {
		entry.refuse(w, http.StatusServiceUnavailable, &solver.Error{Code: solver.CodeBusy})
		return
	}
	defer release()
	ctx, cancel := context.WithTimeout(r.Context(), s.timeout)
	defer cancel()
	resp, err := s.solve(ctx, req, solver.Options{})
	if err != nil {
		s.refuseRun(w, entry, err)
		return
	}
	entry.arrangements = len(resp.Arrangements)
	entry.status = http.StatusOK
	writeJSON(w, http.StatusOK, resp)
}

func (s *server) acquire() (release func(), ok bool) {
	select {
	case s.slots <- struct{}{}:
		return func() { <-s.slots }, true
	default:
		return nil, false
	}
}

func (s *server) refuseRun(w http.ResponseWriter, entry *logEntry, err error) {
	var refusal *solver.Error
	switch {
	case errors.As(err, &refusal):
		entry.refuse(w, statusByCode[refusal.Code], refusal)
	case errors.Is(err, context.DeadlineExceeded):
		entry.refuse(w, http.StatusGatewayTimeout, &solver.Error{Code: solver.CodeTimeout})
	case errors.Is(err, context.Canceled):
		entry.status, entry.code = statusClientClosed, "client_closed"
	default:
		entry.refuse(w, http.StatusInternalServerError, &solver.Error{Code: solver.CodeInternal})
	}
}

func decodeRequest(w http.ResponseWriter, r *http.Request) (solver.Request, *solver.Error) {
	var req solver.Request
	if mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type")); err != nil || mediaType != "application/json" {
		return req, &solver.Error{Code: solver.CodeMalformedRequest, Field: "Content-Type"}
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&req); err != nil {
		return req, &solver.Error{Code: solver.CodeMalformedRequest}
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		return req, &solver.Error{Code: solver.CodeMalformedRequest}
	}
	if field := missingArray(req); field != "" {
		return req, &solver.Error{Code: solver.CodeMalformedRequest, Field: field}
	}
	return req, nil
}

// missingArray names the first required array that was absent or null.
func missingArray(req solver.Request) string {
	switch {
	case req.Desks == nil:
		return "desks"
	case req.Students == nil:
		return "students"
	case req.Rules == nil:
		return "rules"
	}
	return ""
}

func writeError(w http.ResponseWriter, status int, refusal *solver.Error) {
	writeJSON(w, status, errorEnvelope{Error: errorBody{Code: refusal.Code, Field: refusal.Field, Limit: refusal.Limit}})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	var buffer bytes.Buffer
	if err := json.NewEncoder(&buffer).Encode(body); err != nil {
		http.Error(w, "internal", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(buffer.Bytes())
}
