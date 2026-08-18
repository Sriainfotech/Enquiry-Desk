// Mirrors the choice lists defined on the Django models (enquiries/models.py, customers/models.py)
// so dropdown options stay in sync with what the backend will actually accept.

export const BUSINESS_LINES = [
  "Laptop Sales", "Desktop Sales", "Networking", "CCTV", "Software Services",
  "Cloud Services", "AMC", "IT Support", "Hardware", "Cyber Security", "Other",
];
export const ENQUIRY_SOURCES = [
  "Website", "Referral", "Cold Call", "Email", "Phone", "Walk-in",
  "Existing Client", "Exhibition", "Social Media", "Other",
];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
// Suggestions only (autocomplete) — sales_person is a free-text field on the backend,
// not a fixed enum, since sales staff change more often than code should.
export const SALES_PERSONS = ["Arjun Verma", "Kavya Reddy", "Manoj Iyer", "Divya Nair"];

export const ENQUIRY_STATUSES = [
  "New", "In Progress", "Quotation Prepared", "Quotation Shared",
  "Negotiation", "Won", "Lost", "Cancelled",
];
export const QUOTATION_STATUSES = ["Not Prepared", "Draft", "Prepared", "Shared", "Accepted", "Rejected", "Expired"];
export const ORDER_STATUSES = ["Not Converted", "Pending", "Confirmed", "Partially Confirmed", "Cancelled", "Completed"];
export const INVOICE_STATUSES = ["Not Generated", "Draft", "Generated", "Sent", "Cancelled"];
export const PAYMENT_STATUSES = ["Not Paid", "Partially Paid", "Paid", "Overdue"];

export const CUSTOMER_TYPES = ["Corporate", "Enterprise", "Government", "SME", "Individual", "Reseller"];
export const COMPANY_TYPES = ["Private Limited", "Public Limited", "Partnership", "Proprietorship", "LLP", "Government", "Other"];
export const INDUSTRIES = [
  "IT & Software", "Manufacturing", "Healthcare", "Education", "BFSI",
  "Retail", "Logistics", "Government", "Real Estate", "Hospitality",
];
export const UNITS = ["Nos", "Set", "Box", "License", "Service", "Meter"];
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

// Mirrors ALLOWED_ATTACHMENT_EXTENSIONS / MAX_ATTACHMENT_SIZE_MB in
// backend/enquiries/serializers.py — the backend is authoritative either way.
export const ATTACHMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"];
export const MAX_ATTACHMENT_SIZE_MB = 10;

export const PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const CUSTOMER_SORT_OPTIONS = [
  { value: "-created_at", label: "Newest First" },
  { value: "created_at", label: "Oldest First" },
  { value: "company_name", label: "Company Name A-Z" },
  { value: "-company_name", label: "Company Name Z-A" },
  { value: "-updated_at", label: "Recently Updated" },
];

export const ENQUIRY_SORT_OPTIONS = [
  { value: "-enquiry_date", label: "Newest First" },
  { value: "enquiry_date", label: "Oldest First" },
  { value: "-enquiry_number", label: "Enquiry Number (newest)" },
  { value: "enquiry_number", label: "Enquiry Number (oldest)" },
  { value: "customer__company_name", label: "Customer Name A-Z" },
  { value: "-quotation__total_value", label: "Quotation Value High-Low" },
  { value: "-order__value", label: "Order Value High-Low" },
  { value: "-updated_at", label: "Last Updated" },
];
