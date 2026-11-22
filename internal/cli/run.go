// Package cli is the command-line adapter: argv in, exit code out.
package cli

import (
	"fmt"
	"io"
	"math/rand/v2"
	"strconv"
	"time"

	"dsseating/seating"
)

const pcgSecondWord = 0x9E3779B97F4A7C15

func itoa(n int) string { return strconv.Itoa(n) }

// Run executes the program and returns the exit code. It alone recovers panics.
func Run(args []string, stdout, stderr io.Writer) int {
	return run(args, stdout, stderr, clockSeed)
}

func clockSeed() uint64 { return uint64(time.Now().UnixNano()) }

func run(args []string, stdout, stderr io.Writer, seedFromClock func() uint64) (code int) {
	defer func() {
		if r := recover(); r != nil {
			writeError(stderr, fmt.Sprintf("%s%v", internalText, r))
			code = exitIO
		}
	}()
	if wantsHelp(args) {
		io.WriteString(stdout, Help())
		return exitOK
	}
	if err := execute(args, stdout, stderr, seedFromClock); err != nil {
		exit, msg := classify(err)
		writeError(stderr, msg)
		return exit
	}
	return exitOK
}

func execute(args []string, stdout, stderr io.Writer, seedFromClock func() uint64) error {
	people := seating.DefaultPeople()
	opts, err := Parse(args, people)
	if err != nil {
		return err
	}
	problem, err := seating.NewProblem(seating.DefaultLayout(), people, seating.DefaultFrontRowScores(), opts.Rules)
	if err != nil {
		return err
	}
	if !opts.SeedGiven {
		opts.Seed = seedFromClock()
	}
	for _, note := range Notes(opts) {
		fmt.Fprintln(stderr, notePrefix+note)
	}
	writer := &reportWriter{dir: opts.Out, people: people}
	if err := writer.ensureDir(); err != nil {
		return err
	}
	rng := rand.New(rand.NewPCG(opts.Seed, pcgSecondWord))
	final, err := seating.Run(problem, opts.Config, rng, writer.write)
	if err != nil {
		return err
	}
	_, err = io.WriteString(stdout, Summary(RunSummary{
		Seed: opts.Seed, Best: final.Individuals[final.Best], People: people, OutDir: opts.Out, Files: writer.written,
	}))
	return err
}
