import { useEffect, useState } from "react";
import { Building2, Plus, Search } from "lucide-react";
import { listCustomers } from "../api/customers";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { inputCls } from "./ui";

export default function CustomerCombobox({ selectedCustomer, onSelect, onAddNew }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const debouncedText = useDebouncedValue(text, 300);

  useEffect(() => {
    if (!open) return;
    listCustomers({ search: debouncedText || undefined, is_active: true, page_size: 8 })
      .then((res) => setResults(res.results))
      .catch(() => {});
  }, [debouncedText, open]);

  if (selectedCustomer) {
    return (
      <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-slate-50">
        <div className="flex items-center gap-2">
          <Building2 size={15} className="text-teal-600" />
          <span className="text-sm font-medium text-slate-800">{selectedCustomer.company_name}</span>
        </div>
        <button onClick={() => onSelect(null)} className="text-xs text-teal-600 font-medium hover:underline">Change</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className={inputCls + " pl-9"}
          placeholder="Search customer…"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
        />
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-400">No matching customers.</p>}
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelect(c); setOpen(false); setText(""); }}
              className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
            >
              <Building2 size={14} className="text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-sm text-slate-800">{c.company_name}</p>
                <p className="text-[11px] text-slate-400">{c.city}{c.city && " · "}{c.contact_person}</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => { onAddNew(text); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 hover:bg-teal-50 flex items-center gap-2 text-teal-700 font-medium text-sm border-t border-slate-100"
          >
            <Plus size={14} /> Add New Customer
          </button>
        </div>
      )}
    </div>
  );
}
