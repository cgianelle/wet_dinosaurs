package api

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"dsseating/solver"
)

const fixtureDir = "../../contract/fixtures"

type manifest struct {
	Cases []struct {
		Name     string `json:"name"`
		Status   int    `json:"status"`
		Request  string `json:"request"`
		Response string `json:"response"`
		Error    string `json:"error"`
	} `json:"cases"`
}

func fixture(t *testing.T, name string) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtureDir, name))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func post(handler http.Handler, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/v1/solve", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)) }

func newHandler(cfg Config) http.Handler {
	if cfg.Logger == nil {
		cfg.Logger = quiet()
	}
	return New(cfg)
}

func canonical(t *testing.T, raw []byte) string {
	t.Helper()
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		t.Fatalf("%v: %s", err, raw)
	}
	out, _ := json.Marshal(value)
	return string(out)
}

func TestContractFixturesGetTheRecordedStatusAndBody(t *testing.T) {
	var m manifest
	if err := json.Unmarshal(fixture(t, "manifest.json"), &m); err != nil {
		t.Fatal(err)
	}
	handler := newHandler(Config{})
	for _, c := range m.Cases {
		if c.Request == "" {
			continue
		}
		t.Run(c.Name, func(t *testing.T) {
			rec := post(handler, fixture(t, c.Request))
			if rec.Code != c.Status {
				t.Fatalf("status %d, want %d: %s", rec.Code, c.Status, rec.Body)
			}
			if c.Error != "" {
				if got, want := canonical(t, rec.Body.Bytes()), canonical(t, fixture(t, c.Error)); got != want {
					t.Errorf("body %s, want %s", got, want)
				}
				return
			}
			var resp solver.Response
			decoder := json.NewDecoder(rec.Body)
			decoder.DisallowUnknownFields()
			if err := decoder.Decode(&resp); err != nil || len(resp.Arrangements) == 0 {
				t.Errorf("response did not decode: %v", err)
			}
		})
	}
}

func TestServerFailureFixturesHaveTheStatusesTheHandlerSends(t *testing.T) {
	var m manifest
	_ = json.Unmarshal(fixture(t, "manifest.json"), &m)
	for _, c := range m.Cases {
		if c.Request != "" {
			continue
		}
		var body errorEnvelope
		_ = json.Unmarshal(fixture(t, c.Error), &body)
		if statusByCode[body.Error.Code] != c.Status {
			t.Errorf("%s: fixture status %d, handler status %d", c.Name, c.Status, statusByCode[body.Error.Code])
		}
	}
}

func TestMalformedBodiesAreRefused(t *testing.T) {
	valid := string(fixture(t, "valid-minimal.request.json"))
	cases := map[string]string{
		"not json":         "{",
		"unknown field":    strings.Replace(valid, `"grid"`, `"extra": 1, "grid"`, 1),
		"trailing data":    valid + " {}",
		"missing students": strings.Replace(valid, `"students"`, `"pupils"`, 1),
		"null rules":       strings.Replace(valid, `"rules": [`, `"rules": null, "x": [`, 1),
		"empty":            "",
	}
	handler := newHandler(Config{})
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			rec := post(handler, []byte(body))
			if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"malformed_request"`) {
				t.Errorf("%d %s", rec.Code, rec.Body)
			}
		})
	}
}

func TestBodyOverTheLimitIsRefused(t *testing.T) {
	rec := post(newHandler(Config{}), bytes.Repeat([]byte(" "), maxBodyBytes+10))
	if rec.Code != http.StatusBadRequest {
		t.Errorf("status %d", rec.Code)
	}
}

func TestOnlyPostWithJSONIsAccepted(t *testing.T) {
	handler := newHandler(Config{})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/solve", nil))
	if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != http.MethodPost {
		t.Errorf("GET: %d", rec.Code)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/solve", bytes.NewReader(fixture(t, "valid-minimal.request.json")))
	req.Header.Set("Content-Type", "text/plain")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("text/plain: %d", rec.Code)
	}
}

func TestSecondRunIsBusyWhileTheOnlySlotIsTaken(t *testing.T) {
	entered, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	handler := newHandler(Config{MaxInFlight: 1, Solve: func(ctx context.Context, _ solver.Request, _ solver.Options) (solver.Response, error) {
		once.Do(func() { close(entered) })
		<-release
		return solver.Response{}, nil
	}})
	body := fixture(t, "valid-minimal.request.json")
	done := make(chan struct{})
	go func() { post(handler, body); close(done) }()
	<-entered
	rec := post(handler, body)
	if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), `"busy"`) {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
	close(release)
	<-done
	if rec := post(handler, body); rec.Code != http.StatusOK {
		t.Errorf("slot not released: %d", rec.Code)
	}
}

func TestRunsThatOutlastTheTimeoutAreCutOff(t *testing.T) {
	handler := newHandler(Config{Timeout: 20 * time.Millisecond, Solve: func(ctx context.Context, _ solver.Request, _ solver.Options) (solver.Response, error) {
		<-ctx.Done()
		return solver.Response{}, ctx.Err()
	}})
	rec := post(handler, fixture(t, "valid-minimal.request.json"))
	if rec.Code != http.StatusGatewayTimeout || !strings.Contains(rec.Body.String(), `"timeout"`) {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
}

func TestUnexpectedFailuresAreInternalWithoutDetail(t *testing.T) {
	handler := newHandler(Config{Solve: func(context.Context, solver.Request, solver.Options) (solver.Response, error) {
		return solver.Response{}, os.ErrPermission
	}})
	rec := post(handler, fixture(t, "valid-minimal.request.json"))
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "permission") {
		t.Errorf("%d %s", rec.Code, rec.Body)
	}
}

func TestClientDisconnectCancelsTheRun(t *testing.T) {
	cancelled := make(chan error, 1)
	handler := newHandler(Config{Solve: func(ctx context.Context, _ solver.Request, _ solver.Options) (solver.Response, error) {
		<-ctx.Done()
		cancelled <- ctx.Err()
		return solver.Response{}, ctx.Err()
	}})
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodPost, "/v1/solve", bytes.NewReader(fixture(t, "valid-minimal.request.json"))).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	go func() { time.Sleep(10 * time.Millisecond); cancel() }()
	handler.ServeHTTP(httptest.NewRecorder(), req)
	if err := <-cancelled; err != context.Canceled {
		t.Errorf("got %v", err)
	}
}

func TestHealthIsOkAndNotLogged(t *testing.T) {
	var logs bytes.Buffer
	handler := New(Config{Logger: slog.New(slog.NewTextHandler(&logs, nil))})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if rec.Code != http.StatusOK || rec.Body.String() != "ok" || logs.Len() != 0 {
		t.Errorf("%d %q logs=%q", rec.Code, rec.Body, logs.String())
	}
}

func TestRequestLogsCarryCountsAndNeverIdsOrBodies(t *testing.T) {
	var logs bytes.Buffer
	handler := New(Config{Logger: slog.New(slog.NewTextHandler(&logs, nil))})
	body := fixture(t, "valid-irregular-50.request.json")
	post(handler, body)
	post(handler, fixture(t, "error-count_mismatch.request.json"))
	line := logs.String()
	for _, want := range []string{"desks=50", "students=50", "arrangements=3", "error=count_mismatch", "status=400", "path=/v1/solve"} {
		if !strings.Contains(line, want) {
			t.Errorf("log lacks %q:\n%s", want, line)
		}
	}
	for _, forbidden := range []string{"student0", "desk0", "front0", `"grid"`} {
		if strings.Contains(line, forbidden) {
			t.Errorf("log leaks %q", forbidden)
		}
	}
}

func TestStaticDirectoryIsServedOnlyWhenConfigured(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<p>hi</p>"), 0o644); err != nil {
		t.Fatal(err)
	}
	for static, want := range map[string]int{dir: http.StatusOK, "": http.StatusNotFound} {
		rec := httptest.NewRecorder()
		newHandler(Config{StaticDir: static}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
		if rec.Code != want {
			t.Errorf("static=%q: %d, want %d", static, rec.Code, want)
		}
	}
}
