package seating

import (
	"bufio"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// Best-effort FR-23 checks against the read-only Java sample files. Skipped as "unverified" when absent.

const defaultSamplesDir = "/Users/cgianelle/Projects/DSSeating_10_10_03"

type sampleBlock struct {
	labels                     string
	front, nearBy, isle, total int
	weighted                   float64
}

func samplesDir() string {
	if dir := os.Getenv("DSSEATING_SAMPLES"); dir != "" {
		return dir
	}
	return defaultSamplesDir
}

func parseSampleFile(t *testing.T, path string) []sampleBlock {
	t.Helper()
	f, err := os.Open(path)
	if err != nil {
		t.Skipf("unverified: cannot open sample %s: %v", path, err)
	}
	defer f.Close()
	var blocks []sampleBlock
	var cur sampleBlock
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r")
		label, value, ok := strings.Cut(line, ": ")
		if !ok {
			continue
		}
		switch label {
		case "Best Individual", "Individual":
			cur = sampleBlock{labels: value}
		case "Front Row Score":
			cur.front, _ = strconv.Atoi(value)
		case "Near By Score":
			cur.nearBy, _ = strconv.Atoi(value)
		case "Isle Score":
			cur.isle, _ = strconv.Atoi(value)
		case "Total Fitness Score":
			cur.total, _ = strconv.Atoi(value)
		case "Weighted Score":
			cur.weighted, _ = strconv.ParseFloat(value, 64)
			blocks = append(blocks, cur)
		}
	}
	return blocks
}

func TestSampleFilesAreInternallyConsistent(t *testing.T) {
	files, _ := filepath.Glob(filepath.Join(samplesDir(), "Generation*.txt"))
	if len(files) == 0 {
		t.Skip("unverified: no sample Generation*.txt files found in " + samplesDir())
	}
	sort.Strings(files)
	if len(files) > 12 {
		files = files[:12]
	}
	checkedWeighted := 0
	for _, path := range files {
		for i, b := range parseSampleFile(t, path) {
			if !sampleLabelsArePermutation(b.labels) {
				t.Errorf("%s block %d: labels %q are not a permutation of A-T", filepath.Base(path), i, b.labels)
			}
			if b.total != b.front+b.nearBy+b.isle {
				t.Errorf("%s block %d: total %d != %d+%d+%d", filepath.Base(path), i, b.total, b.front, b.nearBy, b.isle)
			}
			if b.weighted > 0 {
				want := float64(weighted100(b.front, b.nearBy, b.isle)) / 100
				if math.Abs(want-b.weighted) > 1e-9 {
					t.Errorf("%s block %d: weighted %v, formula gives %v", filepath.Base(path), i, b.weighted, want)
				}
				checkedWeighted++
			}
		}
	}
	t.Logf("checked weighted formula on %d recorded individuals; Front/Isle/Near By re-scoring is unverified (rule set cannot be inferred)", checkedWeighted)
}

func sampleLabelsArePermutation(labels string) bool {
	if len(labels) != 20 {
		return false
	}
	seen := map[rune]bool{}
	for _, r := range labels {
		if r < 'A' || r > 'T' || seen[r] {
			return false
		}
		seen[r] = true
	}
	return true
}
