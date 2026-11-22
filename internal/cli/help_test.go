package cli

import (
	"strings"
	"testing"
)

func TestHelpMentionsEveryFlagAndAlias(t *testing.T) {
	help := Help()
	for _, spec := range flagTable {
		if !strings.Contains(help, spec.name) {
			t.Errorf("help does not mention %s", spec.name)
		}
	}
	for _, alias := range helpAliases {
		if !strings.Contains(help, alias) {
			t.Errorf("help does not mention %s", alias)
		}
	}
}

func TestHelpStatesDefaultsNextToRandomAndCX(t *testing.T) {
	for _, flag := range []string{"-random", "-cx"} {
		found := false
		for _, line := range strings.Split(Help(), "\n") {
			if strings.HasPrefix(strings.TrimSpace(line), flag+" ") && strings.Contains(line, "default") {
				found = true
			}
		}
		if !found {
			t.Errorf("no line describes %s as default", flag)
		}
	}
}

func TestHelpFitsNinetyColumnsPlainASCII(t *testing.T) {
	for _, line := range strings.Split(Help(), "\n") {
		if len(line) > 90 {
			t.Errorf("line of %d columns: %q", len(line), line)
		}
	}
	for _, r := range Help() {
		if r > 126 || (r < 32 && r != '\n') {
			t.Errorf("non plain-ASCII rune %q", r)
		}
	}
}

func TestHelpIsGeneratedFromDefaults(t *testing.T) {
	help := Help()
	for _, want := range []string{"(default 50)", "(default 0.9)", "(default 0.1)", "51 files", "Generation49.txt",
		"1:+10  2:+7  3:0  4:-7  5:-10", "(A-T) in a 5x4", "block size 4", "Pick 100 parents", "mates with 50 random others"} {
		if !strings.Contains(help, want) {
			t.Errorf("help lacks %q", want)
		}
	}
	if strings.Contains(help, "{") {
		t.Error("unreplaced placeholder")
	}
}
