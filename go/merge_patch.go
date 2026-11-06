package phala

import "encoding/json"

// Patch is one key of a JSON Merge Patch. Tag the field with omitzero: the
// zero value leaves the key out (unchanged), PatchValue sets it, and
// PatchNull sends null, which removes the key.
type Patch[T any] struct {
	value T
	set   bool
	null  bool
}

// PatchValue returns a patch key that sets v.
func PatchValue[T any](v T) Patch[T] {
	return Patch[T]{value: v, set: true}
}

// PatchNull returns a patch key that removes the key.
func PatchNull[T any]() Patch[T] {
	return Patch[T]{null: true}
}

// IsZero reports whether the key is left out of the patch.
func (p Patch[T]) IsZero() bool {
	return !p.set && !p.null
}

// MarshalJSON encodes the value, or null for PatchNull.
func (p Patch[T]) MarshalJSON() ([]byte, error) {
	if p.null {
		return []byte("null"), nil
	}
	return json.Marshal(p.value)
}
