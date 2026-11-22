package report

import (
	"errors"
	"strings"
	"testing"

	"dsseating/seating"
)

func people() []seating.Person { return seating.DefaultPeople() }

func individual(chromosome seating.Chromosome, f, n, i, w100 int) seating.Individual {
	return seating.Individual{
		Chromosome: chromosome,
		Scores:     seating.Scores{Front: f, NearBy: n, Aisle: i, Total: f + n + i, Weighted100: w100},
	}
}

func identity() seating.Chromosome {
	c := make(seating.Chromosome, 20)
	for i := range c {
		c[i] = i
	}
	return c
}

func TestFileName(t *testing.T) {
	cases := map[int]string{-1: "Generation5050.txt", 0: "Generation0.txt", 49: "Generation49.txt"}
	for generation, want := range cases {
		if got := FileName(generation); got != want {
			t.Errorf("FileName(%d) = %q, want %q", generation, got, want)
		}
	}
}

func TestWeightedFormatting(t *testing.T) {
	cases := map[int]string{
		11916: "119.16", 9700: "97.0", 0: "0.0", 11910: "119.1", -1330: "-13.3",
		-5: "-0.05", 5: "0.05", -100: "-1.0", 740: "7.4",
	}
	for w100, want := range cases {
		if got := FormatWeighted(w100); got != want {
			t.Errorf("FormatWeighted(%d) = %q, want %q", w100, got, want)
		}
	}
}

func TestBestBlockGolden(t *testing.T) {
	ind := individual(identity(), 54, 110, -10, 11916)
	want := "Best Individual: ABCDEFGHIJKLMNOPQRST\n" +
		"Front Row Score: 54\nNear By Score: 110\nIsle Score: -10\n" +
		"Total Fitness Score: 154\nWeighted Score: 119.16\n"
	if got := BestBlock(ind, people()); got != want {
		t.Errorf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestWriteGolden(t *testing.T) {
	inds := make([]seating.Individual, 3)
	for i := range inds {
		inds[i] = individual(identity(), i, 0, 0, 100*i)
	}
	inds[2].Chromosome = seating.Chromosome{1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19}
	pop := seating.Population{Generation: 3, Individuals: inds, Best: 2}
	var sb strings.Builder
	if err := Write(&sb, pop, people()); err != nil {
		t.Fatal(err)
	}
	sep := strings.Repeat("_", 49)
	want := "Best Individual: BACDEFGHIJKLMNOPQRST\nFront Row Score: 2\nNear By Score: 0\nIsle Score: 0\nTotal Fitness Score: 2\nWeighted Score: 2.0\n" + sep + "\n" +
		"Individual: ABCDEFGHIJKLMNOPQRST\nFront Row Score: 0\nNear By Score: 0\nIsle Score: 0\nTotal Fitness Score: 0\nWeighted Score: 0.0\n" + sep + "\n" +
		"Individual: ABCDEFGHIJKLMNOPQRST\nFront Row Score: 1\nNear By Score: 0\nIsle Score: 0\nTotal Fitness Score: 1\nWeighted Score: 1.0\n" + sep + "\n" +
		"Individual: BACDEFGHIJKLMNOPQRST\nFront Row Score: 2\nNear By Score: 0\nIsle Score: 0\nTotal Fitness Score: 2\nWeighted Score: 2.0\n" + sep + "\n"
	if got := sb.String(); got != want {
		t.Errorf("got:\n%q\nwant:\n%q", got, want)
	}
	if strings.Contains(sb.String(), "\r") {
		t.Error("report must use LF only")
	}
}

type failingWriter struct{}

func (failingWriter) Write([]byte) (int, error) { return 0, errors.New("disk full") }

func TestWriteSurfacesWriterErrors(t *testing.T) {
	pop := seating.Population{Individuals: []seating.Individual{individual(identity(), 0, 0, 0, 0)}}
	if err := Write(failingWriter{}, pop, people()); err == nil {
		t.Error("expected error")
	}
}
