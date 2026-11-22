package cli

import (
	"strings"
	"testing"

	"dsseating/seating"
)

func parseArgs(args ...string) (Options, error) { return Parse(args, seating.DefaultPeople()) }

func TestParseDefaults(t *testing.T) {
	opts, err := parseArgs()
	if err != nil {
		t.Fatal(err)
	}
	if opts.Config != seating.DefaultConfig() || opts.Out != "out" || opts.SeedGiven {
		t.Errorf("got %+v", opts)
	}
	if opts.Config.Selection != seating.SelectRandom || opts.Config.Crossover != seating.CrossCycle {
		t.Error("defaults must be -random and -cx")
	}
}

func TestParseValidCommandLine(t *testing.T) {
	opts, err := parseArgs("-frontrow", "a", "-frontrow", "D", "-proximity", "Q", "r", "-isle", "F",
		"-plague", "-pmx", "-xoverrate", "0.85", "-mutrate", ".05", "-killrate", "75",
		"-seed", "42", "-out", "my reports", "-strictprox")
	if err != nil {
		t.Fatal(err)
	}
	c := opts.Config
	if c.Selection != seating.SelectPlague || c.Crossover != seating.CrossPMX || c.CrossoverRate != 0.85 ||
		c.MutationRate != 0.05 || c.KillRate != 75 || opts.Seed != 42 || !opts.SeedGiven || opts.Out != "my reports" {
		t.Errorf("config %+v opts %+v", c, opts)
	}
	r := opts.Rules
	if len(r.FrontRow) != 2 || r.FrontRow[0] != 0 || r.FrontRow[1] != 3 || len(r.NotNear) != 1 ||
		r.NotNear[0] != (seating.Pair{A: 16, B: 17}) || len(r.Aisle) != 1 || r.Aisle[0] != 5 || !r.StrictProximity {
		t.Errorf("rules %+v", r)
	}
	if !opts.KillRateGiven {
		t.Error("kill rate should be marked given")
	}
}

func TestParseBoundaryValues(t *testing.T) {
	valid := [][]string{
		{"-xoverrate", "0"}, {"-xoverrate", "1"}, {"-xoverrate", "1.0"}, {"-mutrate", "+0.5"},
		{"-mutrate", "1e-1"}, {"-killrate", "0"}, {"-killrate", "99"}, {"-seed", "0"},
		{"-seed", "18446744073709551615"}, {"-queen", "-cx"}, {"-random", "-pmx"},
	}
	for _, args := range valid {
		if _, err := parseArgs(args...); err != nil {
			t.Errorf("%v: %v", args, err)
		}
	}
}

func TestParseErrorCatalogue(t *testing.T) {
	cases := []struct {
		args []string
		want string
	}{
		{[]string{"-frontrows"}, "unknown option '-frontrows' (did you mean '-frontrow'?)"},
		{[]string{"-zzz"}, "unknown option '-zzz' (see -h for the option list)"},
		{[]string{"A"}, "unexpected argument 'A' (values must follow their option, for example -frontrow A)"},
		{[]string{"-seed=5"}, "unknown option '-seed=5' (options take a separate value: -seed 5)"},
		{[]string{"--seed", "5"}, "unknown option '--seed' (did you mean '-seed'?)"},
		{[]string{"-frontrow"}, "option '-frontrow' needs a student letter (example: -frontrow A)"},
		{[]string{"-proximity", "Q"}, "option '-proximity' needs two student letters (example: -proximity Q R)"},
		{[]string{"-frontrow", "-isle", "F"}, "option '-frontrow' needs a student letter (example: -frontrow A)"},
		{[]string{"-out", ""}, "option '-out' needs a directory (example: -out reports)"},
		{[]string{"-out"}, "option '-out' needs a directory (example: -out reports)"},
		{[]string{"-seed"}, "option '-seed' needs a number (example: -seed 42)"},
		{[]string{"-frontrow", "Z"}, "'Z' is not a student for -frontrow (students are the letters A-T)"},
		{[]string{"-isle", "AB"}, "'AB' is not a student for -isle (students are the letters A-T)"},
		{[]string{"-proximity", "Q", "q"}, "-proximity needs two different students (got 'Q' twice; example: -proximity Q R)"},
		{[]string{"-frontrow", "a", "-frontrow", "A"}, "student 'A' is given twice for -frontrow (list each student once)"},
		{[]string{"-isle", "F", "-isle", "f"}, "student 'F' is given twice for -isle (list each student once)"},
		{[]string{"-proximity", "Q", "R", "-proximity", "R", "Q"}, "pair R Q is given twice for -proximity (Q R is the same pair; list each pair once)"},
		{[]string{"-mutrate", "abc"}, "'abc' is not a number for -mutrate (use a value from 0.0 to 1.0, for example 0.05)"},
		{[]string{"-xoverrate", "NaN"}, "'NaN' is not a number for -xoverrate (use a value from 0.0 to 1.0, for example 0.05)"},
		{[]string{"-xoverrate", "Inf"}, "'Inf' is not a number for -xoverrate (use a value from 0.0 to 1.0, for example 0.05)"},
		{[]string{"-xoverrate", "1.5"}, "-xoverrate 1.5 is out of range (use a value from 0.0 to 1.0)"},
		{[]string{"-mutrate", "-0.1"}, "-mutrate -0.1 is out of range (use a value from 0.0 to 1.0)"},
		{[]string{"-killrate", "100"}, "-killrate 100 is out of range (use a whole number from 0 to 99)"},
		{[]string{"-killrate", "75.5"}, "'75.5' is not a whole number for -killrate (use 0 to 99)"},
		{[]string{"-killrate", "abc"}, "'abc' is not a whole number for -killrate (use 0 to 99)"},
		{[]string{"-seed", "x"}, "'x' is not a whole number for -seed (use a non-negative whole number, for example 42)"},
		{[]string{"-seed", "-5"}, "'-5' is not a whole number for -seed (use a non-negative whole number, for example 42)"},
		{[]string{"-seed", "18446744073709551616"}, "'18446744073709551616' is not a whole number for -seed (use a non-negative whole number, for example 42)"},
		{[]string{"-plague", "-queen"}, "conflicting selection options '-plague' and '-queen' (choose at most one of -random, -queen, -plague, -beeplague)"},
		{[]string{"-pmx", "-cx"}, "conflicting crossover options '-pmx' and '-cx' (choose at most one of -pmx, -cx)"},
		{[]string{"-plague", "-plague"}, "option '-plague' was given twice (give it once)"},
		{[]string{"-cx", "-cx"}, "option '-cx' was given twice (give it once)"},
		{[]string{"-random", "-random"}, "option '-random' was given twice (give it once)"},
		{[]string{"-seed", "1", "-seed", "2"}, "option '-seed' was given twice (give it once)"},
		{[]string{"-out", "a", "-out", "b"}, "option '-out' was given twice (give it once)"},
		{[]string{"-strictprox", "-strictprox"}, "option '-strictprox' was given twice (give it once)"},
		{[]string{"-killrate", "1", "-killrate", "2"}, "option '-killrate' was given twice (give it once)"},
	}
	for _, tc := range cases {
		_, err := parseArgs(tc.args...)
		if err == nil || err.Error() != tc.want {
			t.Errorf("%v:\n got  %v\n want %s", tc.args, err, tc.want)
			continue
		}
		if code, _ := classify(err); code != exitUsage {
			t.Errorf("%v: exit %d", tc.args, code)
		}
	}
}

func TestParseReportsFirstViolationLeftToRight(t *testing.T) {
	_, err := parseArgs("-frontrow", "Z", "-seed", "x")
	if err == nil || !strings.Contains(err.Error(), "'Z'") {
		t.Errorf("got %v", err)
	}
}

func TestParseValueTokenThatLooksLikeOptionButIsNotKnown(t *testing.T) {
	_, err := parseArgs("-frontrow", "-5")
	if err == nil || err.Error() != "'-5' is not a student for -frontrow (students are the letters A-T)" {
		t.Errorf("got %v", err)
	}
}

func TestLongTokensAreTruncatedInMessages(t *testing.T) {
	_, err := parseArgs("-" + strings.Repeat("x", 100))
	want := "unknown option '-" + strings.Repeat("x", 59) + "...' (see -h for the option list)"
	if err == nil || err.Error() != want {
		t.Errorf("got %v", err)
	}
}

func TestSameStudentMayAppearUnderDifferentRules(t *testing.T) {
	_, err := parseArgs("-frontrow", "F", "-isle", "F", "-proximity", "Q", "R", "-proximity", "Q", "S", "-proximity", "R", "S")
	if err != nil {
		t.Fatal(err)
	}
}

func TestNotes(t *testing.T) {
	cases := []struct {
		args []string
		want []string
	}{
		{[]string{"-frontrow", "A"}, nil},
		{[]string{"-frontrow", "A", "-killrate", "10"}, []string{"-killrate has no effect without -plague or -beeplague"}},
		{[]string{"-frontrow", "A", "-killrate", "10", "-plague"}, nil},
		{[]string{"-frontrow", "A", "-killrate", "10", "-beeplague"}, nil},
		{[]string{"-isle", "A", "-strictprox"}, []string{"-strictprox has no effect without -proximity"}},
		{[]string{}, []string{"no rules given; every score will be 0"}},
		{[]string{"-killrate", "5", "-strictprox"}, []string{
			"-killrate has no effect without -plague or -beeplague",
			"-strictprox has no effect without -proximity",
			"no rules given; every score will be 0"}},
		{[]string{"-frontrow", "A", "-xoverrate", "0", "-mutrate", "0"}, nil},
	}
	for _, tc := range cases {
		opts, err := parseArgs(tc.args...)
		if err != nil {
			t.Fatal(err)
		}
		got := Notes(opts)
		if strings.Join(got, "|") != strings.Join(tc.want, "|") {
			t.Errorf("%v: got %v, want %v", tc.args, got, tc.want)
		}
	}
}

func TestEditDistance(t *testing.T) {
	if editDistance("kitten", "sitting") != 3 || editDistance("", "ab") != 2 || editDistance("a", "a") != 0 {
		t.Error("editDistance wrong")
	}
}
