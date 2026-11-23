package solver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"math/rand/v2"
	"os"
	"path/filepath"
	"testing"
)

// Contract fixtures (AD-5) are shared with the web tests and the api tests. Regenerate them
// with UPDATE_FIXTURES=1 go test ./solver -run TestWriteFixtures; every other test only reads.

const fixtureDir = "../contract/fixtures"

// Case is one entry of contract/fixtures/manifest.json.
type fixtureCase struct {
	Name     string `json:"name"`
	Status   int    `json:"status"`
	Request  string `json:"request,omitempty"`
	Response string `json:"response,omitempty"`
	Error    string `json:"error,omitempty"`
}

type fixtureManifest struct {
	Cases []fixtureCase `json:"cases"`
}

type errorBody struct {
	Error struct {
		Code  Code   `json:"code"`
		Field string `json:"field,omitempty"`
		Limit int    `json:"limit,omitempty"`
	} `json:"error"`
}

func readJSON[T any](t *testing.T, name string) T {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(fixtureDir, name))
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var value T
	if err := decoder.Decode(&value); err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return value
}

func TestFixturesAgreeWithTheSolver(t *testing.T) {
	manifest := readJSON[fixtureManifest](t, "manifest.json")
	if len(manifest.Cases) == 0 {
		t.Fatal("no fixtures")
	}
	for _, c := range manifest.Cases {
		t.Run(c.Name, func(t *testing.T) {
			switch {
			case c.Response != "":
				req := readJSON[Request](t, c.Request)
				assertArrangementsAgreeWithOracle(t, req, readJSON[Response](t, c.Response))
				if _, err := Solve(context.Background(), req, Options{}); err != nil {
					t.Fatalf("valid fixture refused: %v", err)
				}
			case c.Request != "" && c.Error != "":
				want := readJSON[errorBody](t, c.Error).Error
				_, err := Solve(context.Background(), readJSON[Request](t, c.Request), Options{})
				var got *Error
				if !errors.As(err, &got) || got.Code != want.Code || got.Field != want.Field || got.Limit != want.Limit {
					t.Errorf("got %v, want %+v", err, want)
				}
			default:
				readJSON[errorBody](t, c.Error) // server-side failures: shape only
			}
		})
	}
}

func TestIrregularFixtureShowsEveryOutcomeKind(t *testing.T) {
	manifest := readJSON[fixtureManifest](t, "manifest.json")
	kinds := map[string]bool{}
	for _, c := range manifest.Cases {
		if c.Name != "valid-irregular-50" {
			continue
		}
		req := readJSON[Request](t, c.Request)
		if len(req.Desks) != MaxDesks || len(req.Students) != MaxStudents || req.Grid != (Grid{MaxColumns, MaxRows}) {
			t.Errorf("not a boundary room: %d desks, %d students, grid %+v", len(req.Desks), len(req.Students), req.Grid)
		}
		for _, a := range readJSON[Response](t, c.Response).Arrangements {
			for _, o := range a.Outcomes {
				kinds[o.Result] = true
			}
		}
	}
	for _, want := range []string{ResultMet, ResultNeutral, ResultNotMet} {
		if !kinds[want] {
			t.Errorf("no %s outcome in the irregular fixture", want)
		}
	}
}

func TestWriteFixtures(t *testing.T) {
	if os.Getenv("UPDATE_FIXTURES") == "" {
		t.Skip("set UPDATE_FIXTURES=1 to regenerate contract fixtures")
	}
	w := fixtureWriter{t: t}
	w.valid("valid-minimal", validRequest())
	w.valid("valid-irregular-50", irregularRoom())
	for _, edge := range []string{EdgeTop, EdgeBottom, EdgeLeft, EdgeRight} {
		w.valid("valid-gapped-"+edge, gappedRoom(edge))
	}
	for _, e := range errorFixtures() {
		w.refused(e.name, e.status, e.request)
	}
	w.serverFailure("error-busy", 503, CodeBusy)
	w.serverFailure("error-timeout", 504, CodeTimeout)
	w.serverFailure("error-internal", 500, CodeInternal)
	w.writeManifest()
}

type fixtureWriter struct {
	t        *testing.T
	manifest fixtureManifest
}

func (w *fixtureWriter) write(name string, value any) string {
	w.t.Helper()
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		w.t.Fatal(err)
	}
	if err := os.MkdirAll(fixtureDir, 0o755); err != nil {
		w.t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(fixtureDir, name), append(raw, '\n'), 0o644); err != nil {
		w.t.Fatal(err)
	}
	return name
}

func (w *fixtureWriter) valid(name string, req Request) {
	resp, err := Solve(context.Background(), req, Options{})
	if err != nil {
		w.t.Fatal(err)
	}
	w.manifest.Cases = append(w.manifest.Cases, fixtureCase{
		Name: name, Status: 200,
		Request: w.write(name+".request.json", req), Response: w.write(name+".response.json", resp),
	})
}

func (w *fixtureWriter) refused(name string, status int, req Request) {
	_, err := Solve(context.Background(), req, Options{})
	var refusal *Error
	if !errors.As(err, &refusal) {
		w.t.Fatalf("%s: expected a refusal, got %v", name, err)
	}
	var body errorBody
	body.Error.Code, body.Error.Field, body.Error.Limit = refusal.Code, refusal.Field, refusal.Limit
	w.manifest.Cases = append(w.manifest.Cases, fixtureCase{
		Name: name, Status: status,
		Request: w.write(name+".request.json", req), Error: w.write(name+".error.json", body),
	})
}

func (w *fixtureWriter) serverFailure(name string, status int, code Code) {
	var body errorBody
	body.Error.Code = code
	w.manifest.Cases = append(w.manifest.Cases, fixtureCase{Name: name, Status: status, Error: w.write(name+".error.json", body)})
}

func (w *fixtureWriter) writeManifest() { w.write("manifest.json", w.manifest) }

type errorFixture struct {
	name    string
	status  int
	request Request
}

func errorFixtures() []errorFixture {
	mutated := func(change func(*Request)) Request {
		req := validRequest()
		change(&req)
		return req
	}
	return []errorFixture{
		{"error-malformed_request", 400, mutated(func(r *Request) { r.Desks[0].ID = "has space" })},
		{"error-limit_exceeded-grid-columns", 400, mutated(func(r *Request) { r.Grid.Columns = MaxColumns + 1 })},
		{"error-limit_exceeded-grid-rows", 400, mutated(func(r *Request) { r.Grid.Rows = MaxRows + 1 })},
		{"error-limit_exceeded-desks", 400, mutated(func(r *Request) { r.Grid = Grid{MaxColumns, MaxRows}; r.Desks = manyDesks(MaxDesks + 1) })},
		{"error-limit_exceeded-students", 400, mutated(func(r *Request) { r.Students = manyStudents(MaxStudents + 1) })},
		{"error-count_mismatch", 400, mutated(func(r *Request) { r.Students = r.Students[:1]; r.Rules = []Rule{} })},
		{"error-no_students", 400, mutated(func(r *Request) { r.Students, r.Rules = []Student{}, []Rule{} })},
		{"error-invalid_front_edge", 400, mutated(func(r *Request) { r.FrontEdge = "middle" })},
		{"error-desks_overlap", 400, mutated(func(r *Request) { r.Desks[1].Column = r.Desks[0].Column; r.Desks[1].Row = r.Desks[0].Row })},
		{"error-desk_out_of_grid", 400, mutated(func(r *Request) { r.Desks[1].Column = r.Grid.Columns })},
		{"error-duplicate_id", 400, mutated(func(r *Request) { r.Students[1].ID = r.Students[0].ID })},
		{"error-unknown_student", 400, mutated(func(r *Request) { r.Rules[0].StudentID = "ghost" })},
		{"error-duplicate_rule", 400, mutated(func(r *Request) {
			r.Rules = append(r.Rules, Rule{ID: "r4", Type: RuleNotNear, StudentIDs: []string{"s2", "s1"}})
		})},
		{"error-self_pair", 400, mutated(func(r *Request) { r.Rules[1].StudentIDs = []string{"s1", "s1"} })},
	}
}

// irregularRoom is a 15 x 15 room with 50 scattered desks, 50 students and rules of every
// kind, with an odd number of desk rows so a front rule can come out Neutral.
func irregularRoom() Request {
	rng := rand.New(rand.NewPCG(2026, 1121))
	req := Request{Grid: Grid{MaxColumns, MaxRows}, FrontEdge: EdgeRight, Rules: []Rule{}}
	cells := rng.Perm(MaxColumns * MaxRows)
	for i := 0; i < MaxDesks; i++ {
		column, row := cells[i]%MaxColumns, cells[i]/MaxColumns
		req.Desks = append(req.Desks, Desk{ID: decimalID("desk", i), Column: column, Row: row})
		req.Students = append(req.Students, Student{ID: decimalID("student", i)})
	}
	for i := 0; i < 24; i++ {
		req.Rules = append(req.Rules, Rule{ID: decimalID("front", i), Type: RuleFront, StudentID: decimalID("student", i)})
	}
	for i := 0; i < 10; i++ {
		req.Rules = append(req.Rules, Rule{ID: decimalID("isle", i), Type: RuleIsle, StudentID: decimalID("student", 30+i)})
	}
	for i := 0; i < 10; i++ {
		req.Rules = append(req.Rules, Rule{ID: decimalID("near", i), Type: RuleNotNear,
			StudentIDs: []string{decimalID("student", 2*i), decimalID("student", 2*i+1)}})
	}
	return req
}

// gappedRoom is a small room with empty interior rows and columns, so the dense-rank reasons
// (row N of M, column N of M count occupied lines only) are pinned for each front wall (AD-5).
func gappedRoom(edge string) Request {
	req := Request{Grid: Grid{Columns: 7, Rows: 6}, FrontEdge: edge}
	cells := [][2]int{{0, 0}, {3, 0}, {6, 0}, {0, 3}, {3, 3}, {6, 3}, {3, 5}}
	for i, cell := range cells {
		req.Desks = append(req.Desks, Desk{ID: decimalID("desk", i), Column: cell[0], Row: cell[1]})
		req.Students = append(req.Students, Student{ID: decimalID("student", i)})
	}
	req.Rules = []Rule{
		{ID: "front-0", Type: RuleFront, StudentID: "student0"},
		{ID: "front-1", Type: RuleFront, StudentID: "student1"},
		{ID: "isle-2", Type: RuleIsle, StudentID: "student2"},
		{ID: "isle-3", Type: RuleIsle, StudentID: "student3"},
		{ID: "near-4-5", Type: RuleNotNear, StudentIDs: []string{"student4", "student5"}},
	}
	return req
}

func TestGappedFixturesCountOnlyOccupiedLines(t *testing.T) {
	for _, edge := range []string{EdgeTop, EdgeBottom, EdgeLeft, EdgeRight} {
		resp := solve(t, gappedRoom(edge))
		for _, outcome := range resp.Arrangements[0].Outcomes {
			if outcome.Detail.Rows > 3 || outcome.Detail.Columns > 3 {
				t.Errorf("%s: %+v counts an empty line", edge, outcome.Detail)
			}
		}
	}
}
