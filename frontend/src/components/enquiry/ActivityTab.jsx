import { Clock } from "lucide-react";
import EmptyState from "../EmptyState";
import { cardCls, sectionTitleCls } from "../ui";
import { formatDateTime } from "../../utils/format";

export default function ActivityTab({ enquiry }) {
  const items = [...enquiry.activities].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  return (
    <div className={`${cardCls} p-5`}>
      <h3 className={sectionTitleCls}><Clock size={15} /> Activity Timeline</h3>
      {items.length === 0 ? (
        <EmptyState icon={Clock} title="No activity yet" message="Changes to this enquiry will be recorded here." />
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-200"></div>
          <div className="space-y-5">
            {items.map((a) => (
              <div key={a.id} className="relative">
                <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-teal-500 border-2 border-white shadow"></div>
                <p className="text-sm text-slate-800 font-medium">{a.action}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(a.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
