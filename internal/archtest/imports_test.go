// Package archtest enforces the import rules between packages (AD-1).
package archtest

import (
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
)

var forbiddenEverywhere = []string{"os", "io/fs", "flag", "time", "bufio", "log"}

func imports(t *testing.T, pkg string) []string {
	t.Helper()
	goBin, err := exec.LookPath("go")
	if err != nil {
		goBin = filepath.Join(runtime.GOROOT(), "bin", "go")
	}
	cmd := exec.Command(goBin, "list", "-f", `{{join .Imports "\n"}}`, pkg)
	cmd.Dir = "../.."
	out, err := cmd.Output()
	if err != nil {
		t.Skipf("go list unavailable: %v", err)
	}
	return strings.Fields(string(out))
}

func TestSeatingImportsNothingImpure(t *testing.T) {
	for _, imp := range imports(t, "./seating") {
		if slices.Contains(forbiddenEverywhere, imp) || strings.HasPrefix(imp, "dsseating/") {
			t.Errorf("seating must not import %s", imp)
		}
	}
}

func TestReportImportsOnlySeatingAndPureStdlib(t *testing.T) {
	allowed := []string{"dsseating/seating", "io", "strconv", "strings"}
	for _, imp := range imports(t, "./report") {
		if !slices.Contains(allowed, imp) {
			t.Errorf("report must not import %s", imp)
		}
	}
}

func TestStandardLibraryOnly(t *testing.T) {
	for _, pkg := range []string{
		"./seating", "./report", "./internal/cli", "./cmd/dsseating",
		"./solver", "./internal/api", "./cmd/dsseating-server",
	} {
		for _, imp := range imports(t, pkg) {
			first, _, _ := strings.Cut(imp, "/")
			if strings.Contains(first, ".") {
				t.Errorf("%s imports third-party %s", pkg, imp)
			}
		}
	}
}

func assertOnlyImports(t *testing.T, pkg string, allowed []string) {
	t.Helper()
	for _, imp := range imports(t, pkg) {
		if !slices.Contains(allowed, imp) {
			t.Errorf("%s must not import %s", pkg, imp)
		}
	}
}

// AD-1: the facade sees the engine and pure stdlib only: no I/O, network, clock or logging.
func TestSolverImportsOnlySeatingAndPureStdlib(t *testing.T) {
	assertOnlyImports(t, "./solver", []string{
		"dsseating/seating", "context", "crypto/sha256", "encoding/binary", "errors", "fmt",
		"math/rand/v2", "slices", "sort", "strings",
	})
}

// AD-1: the HTTP shell reaches the engine only through the facade. errors, io, mime and
// runtime are pure helpers the handler needs beyond the packages AD-1 names.
func TestAPIImportsOnlySolverAndHTTPStdlib(t *testing.T) {
	assertOnlyImports(t, "./internal/api", []string{
		"dsseating/solver", "context", "encoding/json", "errors", "io", "log/slog", "mime",
		"net/http", "runtime", "time", "bytes",
	})
}

// AD-12: the server shim may use flag (the CLI's flag rule does not apply here) and nothing else.
func TestServerShimImportsOnlyAPIAndItsOwnStdlib(t *testing.T) {
	assertOnlyImports(t, "./cmd/dsseating-server", []string{"dsseating/internal/api", "flag", "log/slog", "os"})
}

// The CLI path and the web path never meet (Separate Ways).
func TestCLIAndReportKnowNothingOfTheWebService(t *testing.T) {
	for _, pkg := range []string{"./internal/cli", "./report", "./cmd/dsseating"} {
		for _, imp := range imports(t, pkg) {
			if imp == "dsseating/solver" || imp == "dsseating/internal/api" {
				t.Errorf("%s must not import %s", pkg, imp)
			}
		}
	}
}
