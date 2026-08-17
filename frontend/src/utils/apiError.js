// The backend's exception handler (config/exceptions.py) wraps DRF validation errors as
// { detail, errors: { field: [messages] } }. This flattens that into { field: "message" }
// for direct use as form field error props.
export function fieldErrorsFrom(error) {
  const errors = error?.errors;
  if (!errors || typeof errors !== "object") return {};
  const flat = {};
  for (const [key, value] of Object.entries(errors)) {
    flat[key] = Array.isArray(value) ? value[0] : String(value);
  }
  return flat;
}

export function messageFrom(error) {
  return error?.detail || "Something went wrong. Please try again.";
}
