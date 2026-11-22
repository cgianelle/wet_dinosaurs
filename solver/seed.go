package solver

import (
	"crypto/sha256"
	"encoding/binary"
	"slices"
)

// webStream is the second PCG word for web runs. It is deliberately not the CLI's constant:
// the web needs determinism (FR-24), not stream equality with the CLI (AD-6).
const webStream uint64 = 0x5eed_0eb5_ea71_9001

// seedOf derives the run seed from the canonical input: SHA-256 of a fixed, length-prefixed
// encoding of the sorted room, students and rules; the first 8 bytes, big endian.
func seedOf(grid Grid, edge string, r room) uint64 {
	var enc encoder
	enc.number(grid.Columns)
	enc.number(grid.Rows)
	enc.text(edge)
	enc.number(len(r.desks))
	for _, desk := range r.desks {
		enc.text(desk.ID)
		enc.number(desk.Column)
		enc.number(desk.Row)
	}
	enc.number(len(r.students))
	for _, student := range r.students {
		enc.text(student.ID)
	}
	enc.number(len(r.rules))
	for _, rule := range r.rules {
		enc.text(rule.Type)
		students := slices.Clone(ruleStudents(rule))
		slices.Sort(students)
		enc.text(rule.ID)
		enc.number(len(students))
		for _, id := range students {
			enc.text(id)
		}
	}
	sum := sha256.Sum256(enc.bytes)
	return binary.BigEndian.Uint64(sum[:8])
}

type encoder struct{ bytes []byte }

func (e *encoder) number(n int) { e.bytes = binary.AppendUvarint(e.bytes, uint64(n)) }

func (e *encoder) text(s string) {
	e.number(len(s))
	e.bytes = append(e.bytes, s...)
}
