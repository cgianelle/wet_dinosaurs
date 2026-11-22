package solver

import (
	"fmt"
	"slices"
)

const maxIDLength = 64

// Validate checks everything the client checks (AD-10) and reports the first problem found.
// The checks run in a fixed order so each refusal is deterministic.
func Validate(req Request) error {
	checks := []func(Request) *Error{
		checkIDs, checkLimits, checkFrontEdge, checkDuplicateIDs,
		checkDesksOnGrid, checkCounts, checkRules,
	}
	for _, check := range checks {
		if err := check(req); err != nil {
			return err
		}
	}
	return nil
}

func checkIDs(req Request) *Error {
	for i, desk := range req.Desks {
		if !validID(desk.ID) {
			return refuse(CodeMalformedRequest, fmt.Sprintf("desks[%d].id", i))
		}
	}
	for i, student := range req.Students {
		if !validID(student.ID) {
			return refuse(CodeMalformedRequest, fmt.Sprintf("students[%d].id", i))
		}
	}
	for i, rule := range req.Rules {
		if !validID(rule.ID) {
			return refuse(CodeMalformedRequest, fmt.Sprintf("rules[%d].id", i))
		}
		if !wellShaped(rule) {
			return refuse(CodeMalformedRequest, fmt.Sprintf("rules[%d]", i))
		}
	}
	return nil
}

func validID(id string) bool {
	if id == "" || len(id) > maxIDLength {
		return false
	}
	for _, r := range id {
		isAlphanumeric := r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9'
		if !isAlphanumeric && r != '_' && r != '-' {
			return false
		}
	}
	return true
}

func wellShaped(rule Rule) bool {
	switch rule.Type {
	case RuleFront, RuleIsle:
		return rule.StudentID != "" && len(rule.StudentIDs) == 0
	case RuleNotNear:
		return rule.StudentID == "" && len(rule.StudentIDs) == 2
	}
	return false
}

func checkLimits(req Request) *Error {
	switch {
	case req.Grid.Columns < 1:
		return refuse(CodeMalformedRequest, "grid.columns")
	case req.Grid.Rows < 1:
		return refuse(CodeMalformedRequest, "grid.rows")
	case req.Grid.Columns > MaxColumns:
		return overLimit("grid.columns", MaxColumns)
	case req.Grid.Rows > MaxRows:
		return overLimit("grid.rows", MaxRows)
	case len(req.Desks) > MaxDesks:
		return overLimit("desks", MaxDesks)
	case len(req.Students) > MaxStudents:
		return overLimit("students", MaxStudents)
	}
	return nil
}

func checkFrontEdge(req Request) *Error {
	if !slices.Contains([]string{EdgeTop, EdgeBottom, EdgeLeft, EdgeRight}, req.FrontEdge) {
		return refuse(CodeInvalidFrontEdge, "frontEdge")
	}
	return nil
}

func checkDuplicateIDs(req Request) *Error {
	if hasDuplicate(len(req.Desks), func(i int) string { return req.Desks[i].ID }) {
		return refuse(CodeDuplicateID, "desks")
	}
	if hasDuplicate(len(req.Students), func(i int) string { return req.Students[i].ID }) {
		return refuse(CodeDuplicateID, "students")
	}
	if hasDuplicate(len(req.Rules), func(i int) string { return req.Rules[i].ID }) {
		return refuse(CodeDuplicateID, "rules")
	}
	return nil
}

func hasDuplicate(n int, idAt func(int) string) bool {
	seen := make(map[string]bool, n)
	for i := 0; i < n; i++ {
		if seen[idAt(i)] {
			return true
		}
		seen[idAt(i)] = true
	}
	return false
}

func checkDesksOnGrid(req Request) *Error {
	type cell struct{ column, row int }
	taken := make(map[cell]bool, len(req.Desks))
	for i, desk := range req.Desks {
		if desk.Column < 0 || desk.Column >= req.Grid.Columns || desk.Row < 0 || desk.Row >= req.Grid.Rows {
			return refuse(CodeDeskOutOfGrid, fmt.Sprintf("desks[%d]", i))
		}
		here := cell{desk.Column, desk.Row}
		if taken[here] {
			return refuse(CodeDesksOverlap, fmt.Sprintf("desks[%d]", i))
		}
		taken[here] = true
	}
	return nil
}

func checkCounts(req Request) *Error {
	if len(req.Students) == 0 {
		return refuse(CodeNoStudents, "students")
	}
	if len(req.Students) != len(req.Desks) {
		return refuse(CodeCountMismatch, "students")
	}
	return nil
}

func checkRules(req Request) *Error {
	known := make(map[string]bool, len(req.Students))
	for _, student := range req.Students {
		known[student.ID] = true
	}
	seen := make(map[string]bool, len(req.Rules))
	for i, rule := range req.Rules {
		path := fmt.Sprintf("rules[%d]", i)
		for _, id := range ruleStudents(rule) {
			if !known[id] {
				return refuse(CodeUnknownStudent, path)
			}
		}
		if rule.Type == RuleNotNear && rule.StudentIDs[0] == rule.StudentIDs[1] {
			return refuse(CodeSelfPair, path)
		}
		key := ruleKey(rule)
		if seen[key] {
			return refuse(CodeDuplicateRule, path)
		}
		seen[key] = true
	}
	return nil
}

func ruleStudents(rule Rule) []string {
	if rule.Type == RuleNotNear {
		return rule.StudentIDs
	}
	return []string{rule.StudentID}
}

// ruleKey identifies a rule by its meaning: a not-near pair is unordered.
func ruleKey(rule Rule) string {
	students := slices.Clone(ruleStudents(rule))
	slices.Sort(students)
	return fmt.Sprintf("%s|%q", rule.Type, students)
}
