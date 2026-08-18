// Client-side validation mirrors the Django REST Framework serializer rules exactly
// (see backend/customers/serializers.py and backend/enquiries/serializers.py).
// Frontend validation is for immediate feedback only — the backend is authoritative.

import { ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE_MB } from "../constants";

// Quotation/PO/Invoice numbers come from external systems this app doesn't generate.
// Mirrors DOCUMENT_NUMBER_RE / MAX_DOCUMENT_NUMBER_LENGTH in backend/enquiries/serializers.py.
const DOCUMENT_NUMBER_RE = /^[A-Za-z0-9\-_/]+$/;
const MAX_DOCUMENT_NUMBER_LENGTH = 30;

// Business names legitimately contain digits and punctuation ("3M India", "24/7 Solutions",
// "H&R Block") — must start with a letter/digit so "   " and pure-punctuation strings fail.
const COMPANY_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .,&'()/-]*$/;
// Human names: no digits, must start with a letter (rejects "John123", "12345").
const PERSON_NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
// Job titles legitimately contain digits/ampersands ("HR & Admin", "Level 2 Manager").
const DESIGNATION_RE = /^[A-Za-z0-9][A-Za-z0-9 .&'-]*$/;
const CITY_RE = /^[A-Za-z .'-]+$/;
// Street addresses legitimately contain digits, slashes and "#" ("Flat #302, Road No. 10").
const ADDRESS_RE = /^[A-Za-z0-9][A-Za-z0-9 .,/#()-]*$/;
// Product/service names legitimately contain digits and light punctuation
// ("Laptop 14-inch", "Cisco Switch 24 Port", "CCTV Camera 4MP").
const ITEM_RE = /^[A-Za-z0-9][A-Za-z0-9 .,&/()-]*$/;
// Sales person is free text (not tied to a User FK), but should read as a human name.
const SALES_PERSON_RE = /^[A-Za-z][A-Za-z .'-]*$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
// Indian PIN codes never start with 0.
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const collapseSpaces = (value) => value.replace(/\s+/g, " ").trim();

export function required(value, label) {
  if (value === null || value === undefined || String(value).trim() === "") return `${label} is required.`;
  return null;
}

export function companyName(value) {
  const v = collapseSpaces(value || "");
  if (!v) return "Company name is required.";
  if (v.length < 2) return "Company name must be at least 2 characters.";
  if (v.length > 100) return "Company name cannot exceed 100 characters.";
  if (!COMPANY_NAME_RE.test(v)) return "Company name contains characters that aren't allowed.";
  return null;
}

export function contactPerson(value) {
  const v = collapseSpaces(value || "");
  if (!v) return "Contact person is required.";
  if (v.length < 2) return "Contact person must be at least 2 characters.";
  if (v.length > 50) return "Contact person cannot exceed 50 characters.";
  if (!PERSON_NAME_RE.test(v)) return "Only letters, spaces, apostrophes and hyphens are allowed — no numbers.";
  return null;
}

export function designation(value) {
  const v = collapseSpaces(value || "");
  if (v.length > 50) return "Designation cannot exceed 50 characters.";
  if (v && !DESIGNATION_RE.test(v)) return "Designation contains characters that aren't allowed.";
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
  if (!ADDRESS_RE.test(v)) return "Address contains characters that aren't allowed.";
  return null;
}

export function addressLine2(value) {
  const v = (value || "").trim();
  if (v.length > 150) return "Address line 2 cannot exceed 150 characters.";
  if (v && !ADDRESS_RE.test(v)) return "Address contains characters that aren't allowed.";
  return null;
}

export function city(value) {
  const v = collapseSpaces(value || "");
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

// For optional free-text fields that still need a floor length *if* the user bothers
// to fill them in at all (e.g. Sales Person: blank is fine, but "A" is not).
export function optionalMinMaxLen(value, min, max, label) {
  const v = (value || "").trim();
  if (!v) return null;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} cannot exceed ${max} characters.`;
  return null;
}

export function requirementItem(value) {
  const v = collapseSpaces(value || "");
  if (!v) return "Item is required.";
  if (v.length < 2) return "Item must be at least 2 characters.";
  if (v.length > 100) return "Item cannot exceed 100 characters.";
  if (!ITEM_RE.test(v)) return "Item contains characters that aren't allowed.";
  return null;
}

// Sales Person: optional, but if provided must read as a name (letters/spaces/.'-),
// mirroring the Contact Person rule now that the backend enforces the same pattern.
export function salesPerson(value) {
  const v = collapseSpaces(value || "");
  if (!v) return null;
  if (v.length < 2) return "Sales person must be at least 2 characters.";
  if (v.length > 50) return "Sales person cannot exceed 50 characters.";
  if (!SALES_PERSON_RE.test(v)) return "Sales person can only contain letters, spaces, apostrophes and hyphens.";
  return null;
}

export function enquiryDate(value) {
  if (!value) return "Enquiry date is required.";
  const today = new Date().toISOString().slice(0, 10);
  if (value > today) return "Enquiry date cannot be in the future.";
  return null;
}

// Optional external document number (Quotation/Order/PO/Invoice) — blank is valid
// (the field just isn't known yet), but a value that IS entered must match the real
// external numbering format: letters, digits, hyphen, slash, underscore only.
export function documentNumber(value, label) {
  const v = (value || "").trim();
  if (!v) return null;
  if (v.length > MAX_DOCUMENT_NUMBER_LENGTH) return `${label} cannot exceed ${MAX_DOCUMENT_NUMBER_LENGTH} characters.`;
  if (!DOCUMENT_NUMBER_RE.test(v)) return `${label} can only contain letters, numbers, hyphens, slashes and underscores.`;
  return null;
}

// Mirrors validate_attachment_file in backend/enquiries/serializers.py — the backend
// also checks declared content-type and magic bytes, which the browser can't do, so
// this is UX-only: it stops obviously-bad files before they hit the network, nothing more.
export function attachmentFile(file) {
  const name = file.name || "";
  if (!name) return "A file name is required.";
  if (name.length > 255) return "Filename is too long (maximum 255 characters).";
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  if (!ATTACHMENT_EXTENSIONS.includes(ext)) {
    return "PDF, DOC, DOCX, XLS, XLSX, JPG and PNG files are allowed.";
  }
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
    return "File size must not exceed 10 MB.";
  }
  return null;
}

// Discrete-count units can't have a fractional quantity ("2.5 Nos" doesn't mean
// anything); "Meter" is a physical measurement and legitimately can. Mirrors
// WHOLE_NUMBER_UNITS in backend/enquiries/serializers.py.
const WHOLE_NUMBER_UNITS = ["Nos", "Set", "Box", "License", "Service"];

export function quantity(value, unit) {
  const n = Number(value);
  if (value === "" || value === null || Number.isNaN(n)) return "Quantity is required.";
  if (n <= 0) return "Quantity must be greater than zero.";
  if (n > 999999) return "Quantity cannot exceed 999999.";
  if (unit && WHOLE_NUMBER_UNITS.includes(unit) && !Number.isInteger(n)) {
    return `Quantity must be a whole number for unit '${unit}'.`;
  }
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

// For amounts that are genuinely optional (e.g. Tax) — blank is valid and treated as
// 0, but anything actually typed still has to be a real, non-negative amount.
export function optionalMoney(value, label) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return `${label} must be a valid number.`;
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

// Cross-field checks for the Customer form — run once at submit time (not per-field
// on blur, since they depend on two fields) and merged into the error map.
export function customerCrossFieldErrors(draft) {
  const errors = {};
  if (draft.mobile && draft.alternate_mobile && draft.mobile === draft.alternate_mobile) {
    errors.alternate_mobile = "Alternate mobile number must be different from mobile number.";
  }
  if (draft.email && draft.alternate_email && draft.email.trim().toLowerCase() === draft.alternate_email.trim().toLowerCase()) {
    errors.alternate_email = "Alternate email must be different from email.";
  }
  return errors;
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
