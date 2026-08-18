// The backend's exception handler (config/exceptions.py) wraps DRF validation errors as
// { detail, errors: { field: [messages] } }. This flattens that into { field: "message" }
// for direct use as form field error props. A many=True serializer (bulk Requirement
// rows) instead produces a LIST under `errors` — that shape is handled separately by
// requirementRowErrorsFrom below, so this bails out rather than mangling it.
export function fieldErrorsFrom(error) {
  const errors = error?.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) return {};
  const flat = {};
  for (const [key, value] of Object.entries(errors)) {
    flat[key] = Array.isArray(value) ? value[0] : String(value);
  }
  return flat;
}

// For bulk Requirement-row submissions, DRF's many=True validation error is a list
// with one entry per row — e.g. [{}, {"item": ["This field may not be blank."]}] means
// row 0 was fine and row 1's item was blank. Maps that onto the same
// { [requirement key]: { field: "message" } } shape RequirementsEditor already expects,
// using `requirements` (the exact array that was submitted) to recover each row's
// stable id/localId key since the error list itself is only ever index-based.
export function requirementRowErrorsFrom(error, requirements) {
  const errors = error?.errors;
  if (!Array.isArray(errors)) return {};
  const rowErrs = {};
  errors.forEach((rowError, index) => {
    if (!rowError || typeof rowError !== "object" || Array.isArray(rowError)) return;
    const keys = Object.keys(rowError);
    if (!keys.length) return;
    const row = requirements[index];
    if (!row) return;
    const rowKey = row.id ?? row.localId;
    const flat = {};
    for (const field of keys) {
      const value = rowError[field];
      flat[field] = Array.isArray(value) ? value[0] : String(value);
    }
    rowErrs[rowKey] = flat;
  });
  return rowErrs;
}

export function messageFrom(error) {
  return error?.detail || "Something went wrong. Please try again.";
}
