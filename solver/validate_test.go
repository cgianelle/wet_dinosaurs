package solver

import (
	"errors"
	"strings"
	"testing"
)

func validRequest() Request {
	return Request{
		Grid:      Grid{Columns: 3, Rows: 3},
		FrontEdge: EdgeTop,
		Desks:     []Desk{{"d1", 0, 0}, {"d2", 1, 0}},
		Students:  []Student{{"s1"}, {"s2"}},
		Rules: []Rule{
			{ID: "r1", Type: RuleFront, StudentID: "s1"},
			{ID: "r2", Type: RuleNotNear, StudentIDs: []string{"s1", "s2"}},
			{ID: "r3", Type: RuleIsle, StudentID: "s2"},
		},
	}
}

func TestValidateAcceptsAValidRequest(t *testing.T) {
	if err := Validate(validRequest()); err != nil {
		t.Fatal(err)
	}
}

func manyDesks(n int) []Desk {
	desks := make([]Desk, n)
	for i := range desks {
		desks[i] = Desk{ID: decimalID("d", i), Column: i % MaxColumns, Row: i / MaxColumns}
	}
	return desks
}

func manyStudents(n int) []Student {
	students := make([]Student, n)
	for i := range students {
		students[i] = Student{ID: decimalID("s", i)}
	}
	return students
}

func decimalID(prefix string, i int) string { return prefix + decimal(i) }

func TestValidateRefusesWithTheContractCode(t *testing.T) {
	cases := []struct {
		name   string
		change func(*Request)
		code   Code
		field  string
		limit  int
	}{
		{"bad desk id", func(r *Request) { r.Desks[0].ID = "has space" }, CodeMalformedRequest, "desks[0].id", 0},
		{"empty student id", func(r *Request) { r.Students[1].ID = "" }, CodeMalformedRequest, "students[1].id", 0},
		{"overlong rule id", func(r *Request) { r.Rules[0].ID = strings.Repeat("x", 65) }, CodeMalformedRequest, "rules[0].id", 0},
		{"unknown rule type", func(r *Request) { r.Rules[0].Type = "near" }, CodeMalformedRequest, "rules[0]", 0},
		{"front rule with a pair", func(r *Request) { r.Rules[0].StudentIDs = []string{"s1", "s2"} }, CodeMalformedRequest, "rules[0]", 0},
		{"not near with one student", func(r *Request) { r.Rules[1].StudentIDs = []string{"s1"} }, CodeMalformedRequest, "rules[1]", 0},
		{"zero columns", func(r *Request) { r.Grid.Columns = 0 }, CodeMalformedRequest, "grid.columns", 0},
		{"too many columns", func(r *Request) { r.Grid.Columns = 16 }, CodeLimitExceeded, "grid.columns", MaxColumns},
		{"too many rows", func(r *Request) { r.Grid.Rows = 16 }, CodeLimitExceeded, "grid.rows", MaxRows},
		{"too many desks", func(r *Request) { r.Grid = Grid{15, 15}; r.Desks = manyDesks(51) }, CodeLimitExceeded, "desks", MaxDesks},
		{"too many students", func(r *Request) { r.Students = manyStudents(51) }, CodeLimitExceeded, "students", MaxStudents},
		{"bad front edge", func(r *Request) { r.FrontEdge = "middle" }, CodeInvalidFrontEdge, "frontEdge", 0},
		{"duplicate desk id", func(r *Request) { r.Desks[1].ID = "d1" }, CodeDuplicateID, "desks", 0},
		{"duplicate student id", func(r *Request) { r.Students[1].ID = "s1" }, CodeDuplicateID, "students", 0},
		{"duplicate rule id", func(r *Request) { r.Rules[1].ID = "r1" }, CodeDuplicateID, "rules", 0},
		{"desk outside grid", func(r *Request) { r.Desks[1].Column = 3 }, CodeDeskOutOfGrid, "desks[1]", 0},
		{"negative desk row", func(r *Request) { r.Desks[0].Row = -1 }, CodeDeskOutOfGrid, "desks[0]", 0},
		{"two desks in one cell", func(r *Request) { r.Desks[1].Column, r.Desks[1].Row = 0, 0 }, CodeDesksOverlap, "desks[1]", 0},
		{"no students", func(r *Request) { r.Students, r.Rules = []Student{}, []Rule{} }, CodeNoStudents, "students", 0},
		{"more desks than students", func(r *Request) { r.Students = r.Students[:1]; r.Rules = nil }, CodeCountMismatch, "students", 0},
		{"unknown student", func(r *Request) { r.Rules[0].StudentID = "ghost" }, CodeUnknownStudent, "rules[0]", 0},
		{"unknown student in a pair", func(r *Request) { r.Rules[1].StudentIDs[1] = "ghost" }, CodeUnknownStudent, "rules[1]", 0},
		{"self pair", func(r *Request) { r.Rules[1].StudentIDs = []string{"s1", "s1"} }, CodeSelfPair, "rules[1]", 0},
		{"duplicate front rule", func(r *Request) {
			r.Rules = append(r.Rules, Rule{ID: "r4", Type: RuleFront, StudentID: "s1"})
		}, CodeDuplicateRule, "rules[3]", 0},
		{"reversed not near pair", func(r *Request) {
			r.Rules = append(r.Rules, Rule{ID: "r4", Type: RuleNotNear, StudentIDs: []string{"s2", "s1"}})
		}, CodeDuplicateRule, "rules[3]", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := validRequest()
			c.change(&req)
			var got *Error
			if !errors.As(Validate(req), &got) {
				t.Fatalf("expected a solver error")
			}
			if got.Code != c.code || got.Field != c.field || got.Limit != c.limit {
				t.Errorf("got %+v, want code=%s field=%s limit=%d", got, c.code, c.field, c.limit)
			}
		})
	}
}

func TestFrontAndIsleMayApplyToOneStudent(t *testing.T) {
	req := validRequest()
	req.Rules = append(req.Rules, Rule{ID: "r4", Type: RuleIsle, StudentID: "s1"})
	if err := Validate(req); err != nil {
		t.Fatal(err)
	}
}
