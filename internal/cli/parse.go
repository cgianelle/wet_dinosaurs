package cli

import (
	"math"
	"strconv"
	"strings"

	"dsseating/seating"
)

// Options is the result of parsing and validating argv.
type Options struct {
	Config        seating.Config
	Rules         seating.Rules
	Seed          uint64
	SeedGiven     bool
	Out           string
	KillRateGiven bool
}

const defaultOutDir = "out"

type parser struct {
	people    []seating.Person
	opts      Options
	seen      map[string]bool
	selection string // first selection switch seen
	crossover string // first crossover switch seen
	proxSeen  map[seating.Pair]bool
	frontSeen map[int]bool
	isleSeen  map[int]bool
}

// Parse validates args left to right and reports the first violation.
func Parse(args []string, people []seating.Person) (Options, error) {
	p := &parser{
		people:    people,
		opts:      Options{Config: seating.DefaultConfig(), Out: defaultOutDir},
		seen:      map[string]bool{},
		proxSeen:  map[seating.Pair]bool{},
		frontSeen: map[int]bool{},
		isleSeen:  map[int]bool{},
	}
	for i := 0; i < len(args); {
		spec, ok := lookupFlag(args[i])
		if !ok {
			return Options{}, unknownToken(args[i])
		}
		values, err := takeValues(spec, args[i+1:])
		if err != nil {
			return Options{}, err
		}
		if err := p.apply(spec, values); err != nil {
			return Options{}, err
		}
		i += 1 + spec.arity
	}
	return p.opts, nil
}

func takeValues(spec flagSpec, rest []string) ([]string, error) {
	if len(rest) < spec.arity {
		return nil, missingValue(spec)
	}
	values := rest[:spec.arity]
	for _, v := range values {
		if isOptionName(v) || (spec.name == flagOut && v == "") {
			return nil, missingValue(spec)
		}
	}
	return values, nil
}

func missingValue(spec flagSpec) error {
	return usageErrorf("option '%s' needs %s", spec.name, spec.needs)
}

func (p *parser) apply(spec flagSpec, values []string) error {
	switch spec.kind {
	case kindSelection:
		return p.applyGroup(spec.name, &p.selection, "selection", "-random, -queen, -plague, -beeplague", p.setSelection)
	case kindCrossover:
		return p.applyGroup(spec.name, &p.crossover, "crossover", "-pmx, -cx", p.setCrossover)
	case kindOnce:
		if p.seen[spec.name] {
			return usageErrorf("option '%s' was given twice (give it once)", spec.name)
		}
		p.seen[spec.name] = true
	}
	return p.applyValues(spec.name, values)
}

func (p *parser) applyGroup(name string, first *string, noun, choices string, set func(string)) error {
	switch {
	case *first == name:
		return usageErrorf("option '%s' was given twice (give it once)", name)
	case *first != "":
		return usageErrorf("conflicting %s options '%s' and '%s' (choose at most one of %s)", noun, *first, name, choices)
	}
	*first = name
	set(name)
	return nil
}

func (p *parser) setSelection(name string) {
	p.opts.Config.Selection = map[string]seating.SelectionKind{
		flagRandom: seating.SelectRandom, flagQueen: seating.SelectQueen,
		flagPlague: seating.SelectPlague, flagBeePlague: seating.SelectBeePlague,
	}[name]
}

func (p *parser) setCrossover(name string) {
	p.opts.Config.Crossover = map[string]seating.CrossoverKind{flagCX: seating.CrossCycle, flagPMX: seating.CrossPMX}[name]
}

func (p *parser) applyValues(name string, values []string) error {
	switch name {
	case flagFrontRow:
		return p.addStudent(name, values[0], p.frontSeen, &p.opts.Rules.FrontRow)
	case flagIsle:
		return p.addStudent(name, values[0], p.isleSeen, &p.opts.Rules.Aisle)
	case flagProximity:
		return p.addPair(values[0], values[1])
	case flagStrictProx:
		p.opts.Rules.StrictProximity = true
	case flagXoverRate:
		return parseRate(name, values[0], &p.opts.Config.CrossoverRate)
	case flagMutRate:
		return parseRate(name, values[0], &p.opts.Config.MutationRate)
	case flagKillRate:
		p.opts.KillRateGiven = true
		return parseKillRate(values[0], &p.opts.Config.KillRate)
	case flagSeed:
		return p.parseSeed(values[0])
	case flagOut:
		p.opts.Out = values[0]
	}
	return nil
}

func (p *parser) studentIndex(flag, token string) (int, error) {
	label := strings.ToUpper(token)
	for i, person := range p.people {
		if person.Label == label {
			return i, nil
		}
	}
	return 0, usageErrorf("%s is not a student for %s (students are the letters %s)", quote(token), flag, p.studentRange())
}

func (p *parser) studentRange() string {
	return p.people[0].Label + "-" + p.people[len(p.people)-1].Label
}

func (p *parser) addStudent(flag, token string, seen map[int]bool, into *[]int) error {
	index, err := p.studentIndex(flag, token)
	if err != nil {
		return err
	}
	if seen[index] {
		return usageErrorf("student '%s' is given twice for %s (list each student once)", p.people[index].Label, flag)
	}
	seen[index] = true
	*into = append(*into, index)
	return nil
}

func (p *parser) addPair(first, second string) error {
	a, err := p.studentIndex(flagProximity, first)
	if err != nil {
		return err
	}
	b, err := p.studentIndex(flagProximity, second)
	if err != nil {
		return err
	}
	la, lb := p.people[a].Label, p.people[b].Label
	if a == b {
		return usageErrorf("-proximity needs two different students (got '%s' twice; example: -proximity Q R)", la)
	}
	key := seating.Pair{A: min(a, b), B: max(a, b)}
	if p.proxSeen[key] {
		return usageErrorf("pair %s %s is given twice for -proximity (%s %s is the same pair; list each pair once)", la, lb, lb, la)
	}
	p.proxSeen[key] = true
	p.opts.Rules.NotNear = append(p.opts.Rules.NotNear, seating.Pair{A: a, B: b})
	return nil
}

func parseRate(flag, token string, into *float64) error {
	value, err := strconv.ParseFloat(token, 64)
	if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
		return usageErrorf("%s is not a number for %s (use a value from 0.0 to 1.0, for example 0.05)", quote(token), flag)
	}
	if value < 0 || value > 1 {
		return usageErrorf("%s %s is out of range (use a value from 0.0 to 1.0)", flag, token)
	}
	*into = value
	return nil
}

func parseKillRate(token string, into *int) error {
	value, err := strconv.Atoi(token)
	if err != nil {
		return usageErrorf("%s is not a whole number for -killrate (use 0 to 99)", quote(token))
	}
	if value < 0 || value > 99 {
		return usageErrorf("-killrate %s is out of range (use a whole number from 0 to 99)", token)
	}
	*into = value
	return nil
}

func (p *parser) parseSeed(token string) error {
	value, err := strconv.ParseUint(token, 10, 64)
	if err != nil {
		return usageErrorf("%s is not a whole number for -seed (use a non-negative whole number, for example 42)", quote(token))
	}
	p.opts.Seed, p.opts.SeedGiven = value, true
	return nil
}

func unknownToken(token string) error {
	switch {
	case !strings.HasPrefix(token, "-"):
		return usageErrorf("unexpected argument %s (values must follow their option, for example -frontrow A)", quote(token))
	case strings.Contains(token, "="):
		name, value, _ := strings.Cut(token, "=")
		if _, known := lookupFlag(name); known {
			return usageErrorf("unknown option %s (options take a separate value: %s %s)", quote(token), name, value)
		}
	}
	if suggestion := closestFlag(token); suggestion != "" {
		return usageErrorf("unknown option %s (did you mean '%s'?)", quote(token), suggestion)
	}
	return usageErrorf("unknown option %s (see -h for the option list)", quote(token))
}

const maxSuggestionDistance = 2

func closestFlag(token string) string {
	best, bestDistance := "", maxSuggestionDistance+1
	for _, spec := range flagTable {
		if d := editDistance(token, spec.name); d < bestDistance {
			best, bestDistance = spec.name, d
		}
	}
	return best
}

func editDistance(a, b string) int {
	prev := make([]int, len(b)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(a); i++ {
		cur := make([]int, len(b)+1)
		cur[0] = i
		for j := 1; j <= len(b); j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(b)]
}
