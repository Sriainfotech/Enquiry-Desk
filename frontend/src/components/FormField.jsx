import { AlertCircle } from "lucide-react";

export default function FormField({ label, required, error, children, hint, counter, className = "" }) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-[13px] font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {counter && (
          <span className={`text-[11px] flex-shrink-0 ${counter.value > counter.max ? "text-red-500" : counter.value > counter.max * 0.9 ? "text-amber-600" : "text-slate-400"}`}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}
