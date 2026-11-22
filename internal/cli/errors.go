package cli

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"

	"dsseating/seating"
)

const (
	exitOK       = 0
	exitIO       = 1
	exitUsage    = 2
	maxTokenLen  = 60
	errorPrefix  = "dsseating: error: "
	notePrefix   = "dsseating: note: "
	ellipsis     = "..."
	internalText = "internal error: "
)

// failure is the one error type the CLI reports: a single-line message and an exit code.
type failure struct {
	code int
	msg  string
}

func (f *failure) Error() string { return f.msg }

func usageErrorf(format string, args ...any) error {
	return &failure{code: exitUsage, msg: fmt.Sprintf(format, args...)}
}

func ioErrorf(format string, args ...any) error {
	return &failure{code: exitIO, msg: fmt.Sprintf(format, args...)}
}

// classify maps any error to its exit code and single-line message.
func classify(err error) (int, string) {
	var f *failure
	switch {
	case errors.As(err, &f):
		return f.code, f.msg
	case errors.Is(err, seating.ErrInvalidConfig):
		return exitUsage, err.Error()
	default:
		return exitIO, internalText + err.Error()
	}
}

func writeError(w io.Writer, msg string) { fmt.Fprintln(w, errorPrefix+msg) }

// quote wraps a user token in single quotes, truncating long ones.
func quote(token string) string {
	if len(token) > maxTokenLen {
		token = token[:maxTokenLen] + ellipsis
	}
	return "'" + token + "'"
}

// osReason extracts the operating-system reason from a file error.
func osReason(err error) string {
	var pathErr *fs.PathError
	if errors.As(err, &pathErr) {
		return pathErr.Err.Error()
	}
	var linkErr *os.LinkError
	if errors.As(err, &linkErr) {
		return linkErr.Err.Error()
	}
	return err.Error()
}
