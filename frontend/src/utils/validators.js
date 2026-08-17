// Client-side validation mirrors the Django REST Framework serializer rules exactly
// (see backend/customers/serializers.py and backend/enquiries/serializers.py).
// Frontend validation is for immediate feedback only — the backend is authoritative.

const COMPANY_NAME_RE = /^[A-Za-z0-9&.,()\-\s]+$/;
const PERSON_NAME_RE = /^[A-Za-z .'\-]+$/;
const CITY_RE = /^[A-Za-z .'\-]+$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const PINCODE_RE = /^[0-9]{6}$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function required(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return `${label} is required.`;
  return null;
}

export function companyName(value) {
  const v = (value || "").trim();
  if (!v) return "Company name is required.";
  if (v.length < 2) return "Company name must be at least 2 characters.";
  if (v.length > 100) return "Company name cannot exceed 100 characters.";
  if (!COMPANY_NAME_RE.test(v)) return "Company name contains characters that aren't allowed.";
  return null;
}

export function contactPerson(value) {
  const v = (value || "").trim();
  if (!v) return "Contact person is required.";
  if (v.length < 2) return "Contact person must be at least 2 characters.";
  if (v.length > 50) return "Contact person cannot exceed 50 characters.";
  if (!PERSON_NAME_RE.test(v)) return "Only letters, spaces, apostrophes and hyphens are allowed.";
  return null;
}

export function designation(value) {
  const v = (value || "").trim();
  if (v.length > 50) return "Designation cannot exceed 50 characters.";
  return null;
}

export function mobile(value, { requiredField = true, label = "Mobile number" } = {}) {
  const v = (value || "").trim();
  if (!v) return requiredField ? `${label} is required.` : null;
  if (!MOBILE_RE.test(v)) return `${label} must contain exactly 10 digits and start with 6-9.`;
  return null;
}

export function email(value, { requiredField = true, label = "Email" } = {}) {
  const v = (value || "").trim();
  if (!v) return requiredField ? `${label} is required.` : null;
  if (v.length > 254) return `${label} cannot exceed 254 characters.`;
  if (!EMAIL_RE.test(v)) return `Enter a valid ${label.toLowerCase()} address.`;
  return null;
}

export function gstNumber(value) {
  const v = (value || "").trim().toUpperCase();
  if (!v) return null;
  if (v.length !== 15 || !GST_RE.test(v)) return "Enter a valid 15-character GST number.";
  return null;
}

export function panNumber(value) {
  const v = (value || "").trim().toUpperCase();
  if (!v) return null;
  if (v.length !== 10 || !PAN_RE.test(v)) return "Enter a valid 10-character PAN number.";
  return null;
}

export function addressLine1(value) {
  const v = (value || "").trim();
  if (!v) return "Address line 1 is required.";
  if (v.length < 5) return "Address line 1 must be at least 5 characters.";
  if (v.length > 150) return "Address line 1 cannot exceed 150 characters.";
  return null;
}

export function addressLine2(value) {
  const v = (value || "").trim();
  if (v.length > 150) return "Address line 2 cannot exceed 150 characters.";
  return null;
}

export function city(value) {
  const v = (value || "").trim();
  if (!v) return "City is required.";
  if (v.length < 2) return "City must be at least 2 characters.";
  if (v.length > 50) return "City cannot exceed 50 characters.";
  if (!CITY_RE.test(v)) return "Only letters, spaces, apostrophes and hyphens are allowed.";
  return null;
}

export function pincode(value) {
  const v = (value || "").trim();
  if (!v) return "Pincode is required.";
  if (!PINCODE_RE.test(v)) return "Pincode must contain exactly 6 digits.";
  return null;
}

export function website(value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (v.length > 255) return "Website cannot exceed 255 characters.";
  const candidate = /^https?:\/\//i.test(v) ? v : `http://${v}`;
  try {
    // eslint-disable-next-line no-new
    new URL(candidate);
  } catch {
    return "Enter a valid website URL.";
  }
  return null;
}

export function maxLen(value, max, label) {
  if ((value || "").length > max) return `${label} cannot exceed ${max} characters.`;
  return null;
}

export function requirementItem(value) {
  const v = (value || "").trim();
  if (!v) return "Item is required.";
  if (v.length < 2) return "Item must be at least 2 characters.";
  if (v.length > 100) return "Item cannot exceed 100 characters.";
  return null;
}

export function quantity(value) {
  const n = Number(value);
  if (value === "" || value === null || Number.isNaN(n)) return "Quantity is required.";
  if (n <= 0) return "Quantity must be greater than zero.";
  if (n > 999999) return "Quantity cannot exceed 999999.";
  return null;
}

export function unitPrice(value) {
  const n = Number(value);
  if (value === "" || value === null || Number.isNaN(n)) return "Unit price is required.";
  if (n < 0) return "Unit price cannot be negative.";
  if (n > 999999999.99) return "Unit price is too large.";
  return null;
}

export function money(value, label) {
  const n = Number(value);
  if (value === "" || value === null || Number.isNaN(n)) return `${label} is required.`;
  if (n < 0) return `${label} cannot be negative.`;
  if (n > 999999999.99) return `${label} is too large.`;
  return null;
}

// Mirrors ResetPasswordSerializer.validate_new_password on the backend — Django's
// built-in checks (length/common-password/similarity) still run server-side regardless.
export function password(value) {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must contain at least 8 characters.";
  if (!/[A-Z]/.test(value)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(value)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(value)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Password must contain at least one special character.";
  return null;
}

export function confirmPassword(value, original) {
  if (!value) return "Please confirm your new password.";
  if (value !== original) return "Passwords do not match.";
  return null;
}

export function dateNotBefore(value, otherValue, label, otherLabel) {
  if (!value || !otherValue) return null;
  if (value < otherValue) return `${label} cannot be earlier than the ${otherLabel}.`;
  return null;
}

// Runs a {field: validatorFn} map against a values object and returns {field: message}
// for every failing field (skipping nulls). Handy for whole-form submit validation.
export function validateAll(values, rules) {
  const errors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(values[field]);
    if (message) errors[field] = message;
  }
  return errors;
}
