// Shared Tailwind style tokens used across the app — kept in one place so every
// card/input/button reads as one consistent design system.

export const cardCls = "bg-white border border-slate-200 rounded-lg shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
export const inputCls = "w-full h-[38px] px-3 border border-slate-300 rounded-md text-sm text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 bg-white placeholder:text-slate-400 transition-colors";
export const inputErrCls = "w-full h-[38px] px-3 border border-red-400 rounded-md text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-red-500/15 focus:border-red-500 bg-red-50/40 placeholder:text-slate-400 transition-colors";
export const textareaCls = "w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-500/15 focus:border-teal-500 bg-white placeholder:text-slate-400 transition-colors";
export const labelCls = "block text-[13px] font-semibold text-slate-700 mb-1.5";
export const sectionTitleCls = "text-[13px] font-semibold text-slate-800 mb-4 flex items-center gap-2 pb-2.5 border-b border-slate-100 uppercase tracking-wide";
export const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 focus-visible:ring-offset-1";
export const btnPrimary = `inline-flex items-center justify-center gap-1.5 px-4 h-[38px] bg-teal-600 text-white text-[13px] font-semibold rounded-md shadow-sm hover:bg-teal-700 active:bg-teal-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${focusRing}`;
export const btnSecondary = `inline-flex items-center justify-center gap-1.5 px-4 h-[38px] bg-white border border-slate-300 text-slate-700 text-[13px] font-semibold rounded-md hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 transition-colors whitespace-nowrap ${focusRing}`;
export const btnDanger = `inline-flex items-center justify-center gap-1.5 px-4 h-[38px] bg-red-600 text-white text-[13px] font-semibold rounded-md shadow-sm hover:bg-red-700 active:bg-red-800 transition-colors whitespace-nowrap ${focusRing}`;
export const btnGhost = `inline-flex items-center gap-1.5 px-3 h-[34px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap ${focusRing}`;
export const btnGhostSm = `inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors ${focusRing}`;
export const tableHeadCls = "text-left text-[11px] text-slate-500 font-semibold uppercase tracking-wide bg-slate-50/80 border-b border-slate-200";

export const BADGE_MAP = {
  enquiry: {
    New: "bg-slate-100 text-slate-600",
    "In Progress": "bg-blue-100 text-blue-700",
    "Quotation Prepared": "bg-indigo-100 text-indigo-700",
    "Quotation Shared": "bg-violet-100 text-violet-700",
    Negotiation: "bg-amber-100 text-amber-700",
    Won: "bg-green-100 text-green-700",
    Lost: "bg-red-100 text-red-700",
    Cancelled: "bg-slate-200 text-slate-500",
  },
  quotation: {
    "Not Prepared": "bg-slate-100 text-slate-500",
    Draft: "bg-slate-100 text-slate-700",
    Prepared: "bg-blue-100 text-blue-700",
    Shared: "bg-indigo-100 text-indigo-700",
    Accepted: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Expired: "bg-amber-100 text-amber-700",
  },
  order: {
    "Not Converted": "bg-slate-100 text-slate-500",
    Pending: "bg-amber-100 text-amber-700",
    Confirmed: "bg-green-100 text-green-700",
    "Partially Confirmed": "bg-blue-100 text-blue-700",
    Cancelled: "bg-red-100 text-red-700",
    Completed: "bg-teal-100 text-teal-700",
  },
  invoice: {
    "Not Generated": "bg-slate-100 text-slate-500",
    Draft: "bg-slate-100 text-slate-700",
    Generated: "bg-blue-100 text-blue-700",
    Sent: "bg-indigo-100 text-indigo-700",
    Cancelled: "bg-red-100 text-red-700",
  },
  payment: {
    "Not Paid": "bg-red-100 text-red-700",
    "Partially Paid": "bg-amber-100 text-amber-700",
    Paid: "bg-green-100 text-green-700",
    Overdue: "bg-red-200 text-red-800",
  },
  active: {
    Active: "bg-green-100 text-green-700",
    Inactive: "bg-slate-200 text-slate-500",
  },
};
