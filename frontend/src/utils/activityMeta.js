import {
  CheckCircle2, ClipboardList, FileText, IndianRupee, Package, Paperclip, Send, XCircle,
} from "lucide-react";

// Ordered keyword -> {icon, color} map. Activity actions are free text ("Invoice
// Marked as Sent", "Payment Received in Full"), so we match on substrings — first
// match wins, so more specific phrases must come before their broader category.
const RULES = [
  [/attachment|document (added|replaced|removed)/i, { icon: Paperclip, color: "text-slate-500 bg-slate-100" }],
  [/cancelled|rejected/i, { icon: XCircle, color: "text-red-600 bg-red-50" }],
  [/payment/i, { icon: IndianRupee, color: "text-green-600 bg-green-50" }],
  [/completed/i, { icon: CheckCircle2, color: "text-green-600 bg-green-50" }],
  [/accepted|confirmed/i, { icon: CheckCircle2, color: "text-green-600 bg-green-50" }],
  [/shared|sent/i, { icon: Send, color: "text-indigo-600 bg-indigo-50" }],
  [/invoice/i, { icon: FileText, color: "text-blue-600 bg-blue-50" }],
  [/quotation/i, { icon: FileText, color: "text-blue-600 bg-blue-50" }],
  [/order/i, { icon: Package, color: "text-amber-600 bg-amber-50" }],
  [/created/i, { icon: ClipboardList, color: "text-slate-500 bg-slate-100" }],
];

const DEFAULT_META = { icon: ClipboardList, color: "text-slate-500 bg-slate-100" };

export function activityMetaFor(action) {
  if (!action) return DEFAULT_META;
  const match = RULES.find(([pattern]) => pattern.test(action));
  return match ? match[1] : DEFAULT_META;
}

// Fixed categories for the "Activity Type" filter — matched server-side via a
// substring lookup against the action text (there's no dedicated type column).
export const ACTIVITY_TYPE_OPTIONS = ["Enquiry", "Quotation", "Order", "Invoice", "Payment"];
