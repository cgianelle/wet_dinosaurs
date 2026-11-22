// Package report writes populations in the legacy Generation*.txt text format.
package report

import (
	"io"
	"strconv"
	"strings"

	"dsseating/seating"
)

const (
	initialFileNumber = "5050"
	separator         = "_________________________________________________" // 49 underscores
)

// FileName maps a generation to its legacy file name; the initial generation is 5050.
func FileName(generation int) string {
	if generation == seating.InitialGeneration {
		return "Generation" + initialFileNumber + ".txt"
	}
	return "Generation" + strconv.Itoa(generation) + ".txt"
}

// FormatWeighted prints hundredths as the shortest decimal, with ".0" when integral.
func FormatWeighted(weighted100 int) string {
	sign := ""
	if weighted100 < 0 {
		sign, weighted100 = "-", -weighted100
	}
	whole, cents := weighted100/100, weighted100%100
	switch {
	case cents == 0:
		return sign + strconv.Itoa(whole) + ".0"
	case cents%10 == 0:
		return sign + strconv.Itoa(whole) + "." + strconv.Itoa(cents/10)
	default:
		return sign + strconv.Itoa(whole) + "." + twoDigits(cents)
	}
}

func twoDigits(v int) string {
	if v < 10 {
		return "0" + strconv.Itoa(v)
	}
	return strconv.Itoa(v)
}

// BestBlock is the six-line "Best Individual:" block shared by report files and the CLI summary.
func BestBlock(best seating.Individual, people []seating.Person) string {
	return block("Best Individual", best, people)
}

// Write writes one population: the best block, a separator, then every individual block.
func Write(w io.Writer, pop seating.Population, people []seating.Person) error {
	var sb strings.Builder
	sb.WriteString(BestBlock(pop.Individuals[pop.Best], people))
	sb.WriteString(separator + "\n")
	for _, ind := range pop.Individuals {
		sb.WriteString(block("Individual", ind, people))
		sb.WriteString(separator + "\n")
	}
	_, err := io.WriteString(w, sb.String())
	return err
}

func block(heading string, ind seating.Individual, people []seating.Person) string {
	var sb strings.Builder
	sb.WriteString(heading + ": " + labels(ind.Chromosome, people) + "\n")
	sb.WriteString("Front Row Score: " + strconv.Itoa(ind.Scores.Front) + "\n")
	sb.WriteString("Near By Score: " + strconv.Itoa(ind.Scores.NearBy) + "\n")
	sb.WriteString("Isle Score: " + strconv.Itoa(ind.Scores.Aisle) + "\n")
	sb.WriteString("Total Fitness Score: " + strconv.Itoa(ind.Scores.Total) + "\n")
	sb.WriteString("Weighted Score: " + FormatWeighted(ind.Scores.Weighted100) + "\n")
	return sb.String()
}

func labels(c seating.Chromosome, people []seating.Person) string {
	var sb strings.Builder
	for _, person := range c {
		sb.WriteString(people[person].Label)
	}
	return sb.String()
}
