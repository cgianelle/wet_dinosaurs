// Package solver is the pure facade between a classroom room (desks on a grid, a front edge,
// students and rules identified by opaque ids) and the seating engine. Its request and
// response types, with their json tags, are the wire contract of POST /v1/solve (AD-5).
package solver

// Front edges of a room as drawn: row 0 is the top.
const (
	EdgeTop    = "top"
	EdgeBottom = "bottom"
	EdgeLeft   = "left"
	EdgeRight  = "right"
)

// Rule types on the wire.
const (
	RuleFront   = "front"
	RuleNotNear = "notNear"
	RuleIsle    = "isle"
)

// Outcome results on the wire. Neutral occurs only for front rules.
const (
	ResultMet     = "met"
	ResultNeutral = "neutral"
	ResultNotMet  = "notMet"
)

// Request is one Run: the room, the students and the rules. Ids are opaque (AD-4).
type Request struct {
	Grid      Grid      `json:"grid"`
	FrontEdge string    `json:"frontEdge"`
	Desks     []Desk    `json:"desks"`
	Students  []Student `json:"students"`
	Rules     []Rule    `json:"rules"`
}

// Grid is the room lattice in cells.
type Grid struct {
	Columns int `json:"columns"`
	Rows    int `json:"rows"`
}

// Desk is a desk cell; Column and Row are 0-based and row 0 is the top as drawn.
type Desk struct {
	ID     string `json:"id"`
	Column int    `json:"column"`
	Row    int    `json:"row"`
}

// Student is identified by id only; names never cross the wire.
type Student struct {
	ID string `json:"id"`
}

// Rule is a front, notNear or isle rule. Front and isle use StudentID; notNear uses StudentIDs.
type Rule struct {
	ID         string   `json:"id"`
	Type       string   `json:"type"`
	StudentID  string   `json:"studentId,omitempty"`
	StudentIDs []string `json:"studentIds,omitempty"`
}

// Response holds one to three arrangements, already ranked.
type Response struct {
	Arrangements []Arrangement `json:"arrangements"`
}

// Arrangement is one student-to-desk assignment with its score and per-rule outcomes.
type Arrangement struct {
	Rank        int          `json:"rank"`
	Scores      Scores       `json:"scores"`
	RulesMet    int          `json:"rulesMet"`
	RulesTotal  int          `json:"rulesTotal"`
	Assignments []Assignment `json:"assignments"`
	Outcomes    []Outcome    `json:"outcomes"`
}

// Scores are exact integers; Weighted100 is the weighted score in hundredths and the ranking key.
type Scores struct {
	Front       int `json:"front"`
	NearBy      int `json:"nearBy"`
	Isle        int `json:"isle"`
	Total       int `json:"total"`
	Weighted100 int `json:"weighted100"`
}

// Assignment seats one student at one desk.
type Assignment struct {
	StudentID string `json:"studentId"`
	DeskID    string `json:"deskId"`
}

// Outcome is the verdict on one rule in one arrangement, with the facts behind it (FR-35).
type Outcome struct {
	RuleID string `json:"ruleId"`
	Result string `json:"result"`
	Detail Detail `json:"detail"`
}

// Detail carries the reason data; which fields are set depends on the rule type.
// Front: Row and Rows. NotNear: Distance. Isle: Column and Columns. All values are at least 1.
type Detail struct {
	Row      int `json:"row,omitempty"`
	Rows     int `json:"rows,omitempty"`
	Distance int `json:"distance,omitempty"`
	Column   int `json:"column,omitempty"`
	Columns  int `json:"columns,omitempty"`
}
