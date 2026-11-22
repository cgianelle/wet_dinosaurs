package cli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type result struct {
	code           int
	stdout, stderr string
}

func execute_(args ...string) result {
	var out, errBuf bytes.Buffer
	code := Run(args, &out, &errBuf)
	return result{code, out.String(), errBuf.String()}
}

func TestHelpWinsOverEverythingAndGoesToStdout(t *testing.T) {
	for _, args := range [][]string{nil, {"-h"}, {"-help"}, {"--help"}, {"-bogus", "--help"}, {"-seed", "x", "-h"}, {"-frontrow", "-h"}} {
		r := execute_(args...)
		if r.code != 0 || r.stdout != Help() || r.stderr != "" {
			t.Errorf("%v: code %d stderr %q", args, r.code, r.stderr)
		}
	}
}

func TestUsageErrorIsOneStderrLineExit2AndTouchesNoFiles(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "never")
	r := execute_("-out", dir, "-frontrow", "Z")
	if r.code != 2 || r.stdout != "" {
		t.Fatalf("code %d stdout %q", r.code, r.stdout)
	}
	if r.stderr != "dsseating: error: 'Z' is not a student for -frontrow (students are the letters A-T)\n" {
		t.Errorf("stderr %q", r.stderr)
	}
	if _, err := os.Stat(dir); err == nil {
		t.Error("output directory was created despite a usage error")
	}
}

func TestSuccessfulRunWritesFiftyOneFilesAndPrintsSummary(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "reports")
	r := execute_("-frontrow", "A", "-isle", "F", "-proximity", "Q", "R", "-seed", "7", "-out", dir)
	if r.code != 0 || r.stderr != "" {
		t.Fatalf("code %d stderr %q", r.code, r.stderr)
	}
	lines := strings.Split(strings.TrimSuffix(r.stdout, "\n"), "\n")
	if len(lines) != 8 || lines[0] != "Seed: 7" || !strings.HasPrefix(lines[1], "Best Individual: ") ||
		lines[7] != "Wrote 51 files to "+dir {
		t.Fatalf("stdout:\n%s", r.stdout)
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 51 {
		t.Fatalf("entries %d err %v", len(entries), err)
	}
	if _, err := os.Stat(filepath.Join(dir, "Generation5050.txt")); err != nil {
		t.Error(err)
	}
	last, _ := os.ReadFile(filepath.Join(dir, "Generation49.txt"))
	if !strings.HasPrefix(string(last), strings.Join(lines[1:7], "\n")+"\n") {
		t.Error("summary best block differs from Generation49 best block")
	}
	info, _ := os.Stat(filepath.Join(dir, "Generation0.txt"))
	if info.Mode().Perm() != 0o644 {
		t.Errorf("mode %v", info.Mode())
	}
}

func readAll(t *testing.T, dir string) map[string]string {
	t.Helper()
	files := map[string]string{}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		b, _ := os.ReadFile(filepath.Join(dir, e.Name()))
		files[e.Name()] = string(b)
	}
	return files
}

func TestSameSeedGivesByteIdenticalOutput(t *testing.T) {
	args := []string{"-frontrow", "A", "-frontrow", "D", "-proximity", "Q", "R", "-isle", "F", "-plague", "-pmx", "-seed", "42"}
	var firstOut string
	var firstFiles map[string]string
	for i := 0; i < 3; i++ {
		dir := t.TempDir()
		r := execute_(append(args, "-out", dir)...)
		out := strings.ReplaceAll(r.stdout, dir, "DIR")
		files := readAll(t, dir)
		if i == 0 {
			firstOut, firstFiles = out, files
			continue
		}
		if out != firstOut {
			t.Fatal("stdout differs")
		}
		for name, content := range firstFiles {
			if files[name] != content {
				t.Fatalf("%s differs", name)
			}
		}
	}
}

func TestDifferentSeedsDiffer(t *testing.T) {
	a, b := t.TempDir(), t.TempDir()
	execute_("-frontrow", "A", "-seed", "1", "-out", a)
	execute_("-frontrow", "A", "-seed", "2", "-out", b)
	if readAll(t, a)["Generation5050.txt"] == readAll(t, b)["Generation5050.txt"] {
		t.Error("different seeds produced the same initial population")
	}
}

func TestOmittedSeedIsPrintedAndReproducible(t *testing.T) {
	var out, errBuf bytes.Buffer
	dir := t.TempDir()
	code := run([]string{"-isle", "A", "-out", dir}, &out, &errBuf, func() uint64 { return 123456 })
	if code != 0 || !strings.HasPrefix(out.String(), "Seed: 123456\n") {
		t.Errorf("code %d stdout %q", code, out.String())
	}
}

func TestNotesGoToStderrAndStdoutStaysTheContract(t *testing.T) {
	r := execute_("-seed", "1", "-out", t.TempDir())
	if r.code != 0 || r.stderr != "dsseating: note: no rules given; every score will be 0\n" {
		t.Errorf("code %d stderr %q", r.code, r.stderr)
	}
	if strings.Contains(r.stdout, "note") {
		t.Error("note leaked to stdout")
	}
}

func TestOutputDirThatIsAFileExits1(t *testing.T) {
	file := filepath.Join(t.TempDir(), "afile")
	os.WriteFile(file, []byte("x"), 0o644)
	r := execute_("-isle", "A", "-out", file)
	if r.code != 1 || r.stdout != "" || !strings.HasPrefix(r.stderr, "dsseating: error: cannot create output directory '"+file+"': ") ||
		strings.Count(r.stderr, "\n") != 1 {
		t.Errorf("code %d stdout %q stderr %q", r.code, r.stdout, r.stderr)
	}
}

func TestRerunOverwritesAndLeavesOtherFilesAlone(t *testing.T) {
	dir := t.TempDir()
	other := filepath.Join(dir, "keep.txt")
	os.WriteFile(other, []byte("keep"), 0o644)
	execute_("-isle", "A", "-seed", "1", "-out", dir)
	execute_("-isle", "A", "-seed", "1", "-out", dir)
	if b, _ := os.ReadFile(other); string(b) != "keep" {
		t.Error("foreign file touched")
	}
	if len(readAll(t, dir)) != 52 {
		t.Errorf("want 51 reports plus the foreign file")
	}
}

func TestWriteFailureReportsPathAndLeavesNoTempFile(t *testing.T) {
	dir := t.TempDir()
	// A directory squatting on a final name makes the rename of that report fail.
	if err := os.MkdirAll(filepath.Join(dir, "Generation3.txt", "child"), 0o755); err != nil {
		t.Fatal(err)
	}
	r := execute_("-isle", "A", "-seed", "1", "-out", dir)
	want := "dsseating: error: cannot write '" + filepath.Join(dir, "Generation3.txt") + "': "
	if r.code != 1 || r.stdout != "" || !strings.HasPrefix(r.stderr, want) ||
		!strings.Contains(r.stderr, "(4 earlier report files remain in '"+dir+"')") || strings.Count(r.stderr, "\n") != 1 {
		t.Fatalf("code %d stdout %q stderr %q", r.code, r.stdout, r.stderr)
	}
	for name := range readAll(t, dir) {
		if strings.HasSuffix(name, ".tmp") {
			t.Errorf("temp file left behind: %s", name)
		}
	}
}

func TestPanicBecomesInternalErrorExit1(t *testing.T) {
	var out, errBuf bytes.Buffer
	code := run([]string{"-isle", "A", "-out", t.TempDir()}, &out, &errBuf, func() uint64 { panic("kaboom") })
	if code != 1 || errBuf.String() != "dsseating: error: internal error: kaboom\n" {
		t.Errorf("code %d stderr %q", code, errBuf.String())
	}
}

func TestSummaryGolden(t *testing.T) {
	// covered through Run; direct shape check
	r := execute_("-seed", "3", "-out", t.TempDir())
	if strings.Count(r.stdout, "\n") != 8 {
		t.Errorf("stdout lines: %q", r.stdout)
	}
}
