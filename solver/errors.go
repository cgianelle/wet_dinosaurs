package solver

import "fmt"

// Code is a member of the closed error enum of the contract (AD-5).
type Code string

// Error codes. The HTTP status mapping lives in the api package.
const (
	CodeMalformedRequest Code = "malformed_request"
	CodeLimitExceeded    Code = "limit_exceeded"
	CodeCountMismatch    Code = "count_mismatch"
	CodeNoStudents       Code = "no_students"
	CodeInvalidFrontEdge Code = "invalid_front_edge"
	CodeDesksOverlap     Code = "desks_overlap"
	CodeDeskOutOfGrid    Code = "desk_out_of_grid"
	CodeDuplicateID      Code = "duplicate_id"
	CodeUnknownStudent   Code = "unknown_student"
	CodeDuplicateRule    Code = "duplicate_rule"
	CodeSelfPair         Code = "self_pair"
	CodeBusy             Code = "busy"
	CodeTimeout          Code = "timeout"
	CodeInternal         Code = "internal"
)

// Error is a request the service refuses. Field is a JSON path made of names and indices
// only (never ids); Limit is set for CodeLimitExceeded.
type Error struct {
	Code  Code
	Field string
	Limit int
}

func (e *Error) Error() string {
	if e.Field == "" {
		return string(e.Code)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Field)
}

func refuse(code Code, field string) *Error { return &Error{Code: code, Field: field} }

func overLimit(field string, limit int) *Error {
	return &Error{Code: CodeLimitExceeded, Field: field, Limit: limit}
}
