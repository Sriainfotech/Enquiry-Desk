import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { BADGE_MAP } from "./ui";

const STATUS_ICON_MAP = {
  Paid: CheckCircle2, Accepted: CheckCircle2, Confirmed: CheckCircle2, Completed: CheckCircle2, Won: CheckCircle2,
  Overdue: AlertTriangle, Rejected: XCircle, Cancelled: XCircle, Lost: XCircle,
  Pending: Clock, Expired: Clock,
};

export default function StatusBadge({ status, type = "enquiry" }) {
  const cls = (BADGE_MAP[type] && BADGE_MAP[type][status]) || "bg-slate-100 text-slate-600";
  const Icon = STATUS_ICON_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${cls}`}>
      {Icon ? <Icon size={11} strokeWidth={2.5} /> : <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
      {status}
    </span>
  );
}
