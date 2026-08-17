import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { listCustomers } from "../api/customers";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { inputCls } from "./ui";

// Server-side searchable customer picker — never loads the full customer table,
// fetches at most a small page of matches per keystroke (debounced).
export default function AsyncCustomerSelect({ value, valueLabel, onChange, placeholder = "All Customers" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const debouncedQuery = useDebouncedValue(query, 350);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listCustomers({ search: debouncedQuery || undefined, page_size: 8 })
      .then((res) => setResults(res.results))
      .catch(() => {});
  }, [debouncedQuery, open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left ${!value ? "text-slate-400" : ""}`}
      >
        <span className="truncate">{value ? valueLabel : placeholder}</span>
        <span className="flex items-center gap-1 flex-shrink-0 ml-2">
          {value && (
            <span role="button" onClick={(e) => { e.stopPropagation(); onChange(null, null); }} className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-72 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search customer…"
                className="w-full h-8 pl-8 pr-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {results.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-400">No matches.</p>}
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onChange(c.id, c.company_name); setOpen(false); setQuery(""); }}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-slate-50 ${c.id === value ? "font-medium text-teal-800" : "text-slate-700"}`}
              >
                <div className="min-w-0">
                  <p className="truncate">{c.company_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{c.customer_code} · {c.contact_person}</p>
                </div>
                {c.id === value && <Check size={14} className="text-teal-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
