package cli

// Flag names.
const (
	flagFrontRow   = "-frontrow"
	flagProximity  = "-proximity"
	flagIsle       = "-isle"
	flagStrictProx = "-strictprox"
	flagRandom     = "-random"
	flagQueen      = "-queen"
	flagPlague     = "-plague"
	flagBeePlague  = "-beeplague"
	flagKillRate   = "-killrate"
	flagPMX        = "-pmx"
	flagCX         = "-cx"
	flagXoverRate  = "-xoverrate"
	flagMutRate    = "-mutrate"
	flagSeed       = "-seed"
	flagOut        = "-out"
)

var helpAliases = []string{"-h", "-help", "--help"}

type flagKind int

const (
	kindRepeatable flagKind = iota // may be given many times (rules)
	kindOnce                       // a scalar or switch that may be given once
	kindSelection                  // one of the selection switches
	kindCrossover                  // one of the crossover switches
)

type flagSpec struct {
	name  string
	arity int
	kind  flagKind
	needs string // text after "needs " when a value is missing
}

// flagTable lists every option in help order.
var flagTable = []flagSpec{
	{flagFrontRow, 1, kindRepeatable, "a student letter (example: -frontrow A)"},
	{flagProximity, 2, kindRepeatable, "two student letters (example: -proximity Q R)"},
	{flagIsle, 1, kindRepeatable, "a student letter (example: -isle F)"},
	{flagStrictProx, 0, kindOnce, ""},
	{flagRandom, 0, kindSelection, ""},
	{flagQueen, 0, kindSelection, ""},
	{flagPlague, 0, kindSelection, ""},
	{flagBeePlague, 0, kindSelection, ""},
	{flagKillRate, 1, kindOnce, "a number (example: -killrate 50)"},
	{flagCX, 0, kindCrossover, ""},
	{flagPMX, 0, kindCrossover, ""},
	{flagXoverRate, 1, kindOnce, "a number (example: -xoverrate 0.9)"},
	{flagMutRate, 1, kindOnce, "a number (example: -mutrate 0.05)"},
	{flagSeed, 1, kindOnce, "a number (example: -seed 42)"},
	{flagOut, 1, kindOnce, "a directory (example: -out reports)"},
}

func lookupFlag(token string) (flagSpec, bool) {
	for _, spec := range flagTable {
		if spec.name == token {
			return spec, true
		}
	}
	return flagSpec{}, false
}

func isOptionName(token string) bool {
	if _, ok := lookupFlag(token); ok {
		return true
	}
	for _, alias := range helpAliases {
		if token == alias {
			return true
		}
	}
	return false
}

func wantsHelp(args []string) bool {
	if len(args) == 0 {
		return true
	}
	for _, token := range args {
		for _, alias := range helpAliases {
			if token == alias {
				return true
			}
		}
	}
	return false
}
