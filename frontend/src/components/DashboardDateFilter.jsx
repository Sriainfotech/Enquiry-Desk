import { Calendar } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { inputCls } from "./ui";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export default function DashboardDateFilter({ preset, dateFrom, dateTo, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Calendar size={14} className="text-slate-400 flex-shrink-0" />
      <div className="w-[160px]">
        <SearchableSelect
          value={preset}
          onChange={(v) => onChange({ preset: v, dateFrom, dateTo })}
          options={PRESETS}
          clearable={false}
          searchable={false}
        />
      </div>
      {preset === "custom" && (
        <>
          <input
            type="date"
            className={inputCls + " w-[150px]"}
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => onChange({ preset, dateFrom: e.target.value, dateTo })}
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            className={inputCls + " w-[150px]"}
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onChange({ preset, dateFrom, dateTo: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
