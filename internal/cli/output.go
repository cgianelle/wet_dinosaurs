package cli

import (
	"strconv"

	"dsseating/report"
	"dsseating/seating"
)

// RunSummary is everything the success summary prints.
type RunSummary struct {
	Seed   uint64
	Best   seating.Individual
	People []seating.Person
	OutDir string
	Files  int
}

// Summary renders the stdout contract: seed, best individual with five scores, directory and file count.
func Summary(s RunSummary) string {
	return "Seed: " + strconv.FormatUint(s.Seed, 10) + "\n" +
		report.BestBlock(s.Best, s.People) +
		"Wrote " + strconv.Itoa(s.Files) + " files to " + s.OutDir + "\n"
}

// Notes lists non-fatal advisories in their fixed order.
func Notes(o Options) []string {
	var notes []string
	if o.KillRateGiven && o.Config.Selection != seating.SelectPlague && o.Config.Selection != seating.SelectBeePlague {
		notes = append(notes, "-killrate has no effect without -plague or -beeplague")
	}
	if o.Rules.StrictProximity && len(o.Rules.NotNear) == 0 {
		notes = append(notes, "-strictprox has no effect without -proximity")
	}
	if len(o.Rules.FrontRow)+len(o.Rules.NotNear)+len(o.Rules.Aisle) == 0 {
		notes = append(notes, "no rules given; every score will be 0")
	}
	return notes
}
