package cli

import (
	"bufio"
	"os"
	"path/filepath"

	"dsseating/report"
	"dsseating/seating"
)

const (
	dirMode  = 0o755
	fileMode = 0o644
	tempGlob = ".Generation*.tmp"
)

// reportWriter writes each population to a temp file, then renames it into place.
type reportWriter struct {
	dir     string
	people  []seating.Person
	written int
}

func (w *reportWriter) ensureDir() error {
	if err := os.MkdirAll(w.dir, dirMode); err != nil {
		return ioErrorf("cannot create output directory '%s': %s (choose another with -out DIR)", w.dir, osReason(err))
	}
	return nil
}

func (w *reportWriter) write(pop seating.Population) error {
	final := filepath.Join(w.dir, report.FileName(pop.Generation))
	if err := w.writeAtomically(final, pop); err != nil {
		return ioErrorf("cannot write '%s': %s%s", final, osReason(err), w.remainder())
	}
	w.written++
	return nil
}

func (w *reportWriter) remainder() string {
	switch w.written {
	case 0:
		return ""
	case 1:
		return " (1 earlier report file remains in '" + w.dir + "')"
	default:
		return " (" + itoa(w.written) + " earlier report files remain in '" + w.dir + "')"
	}
}

func (w *reportWriter) writeAtomically(final string, pop seating.Population) (err error) {
	temp, err := os.CreateTemp(w.dir, tempGlob)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			temp.Close()
			os.Remove(temp.Name())
		}
	}()
	buffered := bufio.NewWriter(temp)
	if err = report.Write(buffered, pop, w.people); err != nil {
		return err
	}
	if err = buffered.Flush(); err != nil {
		return err
	}
	if err = temp.Sync(); err != nil {
		return err
	}
	if err = temp.Close(); err != nil {
		return err
	}
	if err = os.Chmod(temp.Name(), fileMode); err != nil {
		return err
	}
	return os.Rename(temp.Name(), final)
}
