import { Plus, Trash2 } from "lucide-react";
import { UNITS } from "../constants";
import { formatCurrency } from "../utils/format";
import { inputCls, inputErrCls, btnGhost } from "./ui";
import SearchableSelect from "./SearchableSelect";

function requirementTotal(r) {
  return (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);
}
export function requirementsTotal(list) {
  return (list || []).reduce((sum, r) => sum + requirementTotal(r), 0);
}

let localIdCounter = 0;
export function newRequirementRow() {
  localIdCounter += 1;
  return { localId: `local-${localIdCounter}`, item: "", description: "", quantity: 1, unit: "Nos", unit_price: 0 };
}

export default function RequirementsEditor({ requirements, onChange, rowErrors }) {
  function key(r) {
    return r.id ?? r.localId;
  }
  function updateRow(k, field, value) {
    onChange(requirements.map((r) => (key(r) === k ? { ...r, [field]: value } : r)));
  }
  function removeRow(k) {
    onChange(requirements.filter((r) => key(r) !== k));
  }
  function addRow() {
    onChange([...requirements, newRequirementRow()]);
  }
  const total = requirementsTotal(requirements);

  return (
    <div>
      {/* Desktop / tablet: full table. Hidden on mobile in favor of stacked cards below. */}
      <div className="hidden sm:block overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 font-medium min-w-[160px]">Item / Service</th>
              <th className="px-3 py-2.5 font-medium min-w-[200px]">Description</th>
              <th className="px-3 py-2.5 font-medium w-[100px]">Quantity</th>
              <th className="px-3 py-2.5 font-medium w-[130px]">Unit</th>
              <th className="px-3 py-2.5 font-medium w-[150px] text-right">Unit Price</th>
              <th className="px-3 py-2.5 font-medium w-[130px] text-right">Total</th>
              <th className="px-3 py-2.5 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {requirements.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">No requirements added yet.</td></tr>
            )}
            {requirements.map((r) => {
              const k = key(r);
              const err = rowErrors && rowErrors[k];
              return (
                <tr key={k} className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-2 py-2">
                    <input className={err && err.item ? inputErrCls : inputCls} value={r.item} onChange={(e) => updateRow(k, "item", e.target.value)} placeholder="e.g. Laptop" maxLength={100} />
                    {err && typeof err.item === "string" && <p className="text-[11px] text-red-500 mt-1">{err.item}</p>}
                  </td>
                  <td className="px-2 py-2">
                    <input className={inputCls} value={r.description} onChange={(e) => updateRow(k, "description", e.target.value)} placeholder="Specification / details" maxLength={500} />
                    <p className="text-[10px] text-slate-400 mt-0.5 text-right">{r.description.length}/500</p>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" className={err && err.quantity ? inputErrCls : inputCls} value={r.quantity} onChange={(e) => updateRow(k, "quantity", e.target.value)} />
                    {err && typeof err.quantity === "string" && <p className="text-[11px] text-red-500 mt-1">{err.quantity}</p>}
                  </td>
                  <td className="px-2 py-2">
                    <SearchableSelect value={r.unit} onChange={(v) => updateRow(k, "unit", v)} options={UNITS} clearable={false} searchable={false} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" className={(err && err.unit_price ? inputErrCls : inputCls) + " text-right"} value={r.unit_price} onChange={(e) => updateRow(k, "unit_price", e.target.value)} />
                    {err && typeof err.unit_price === "string" && <p className="text-[11px] text-red-500 mt-1 text-right">{err.unit_price}</p>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800 whitespace-nowrap pt-[9px]">{formatCurrency(requirementTotal(r))}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => removeRow(k)}
                      disabled={requirements.length <= 1}
                      title={requirements.length <= 1 ? "At least one requirement is required" : "Remove requirement"}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: each requirement stacks as its own card — a 7-column row doesn't fit. */}
      <div className="sm:hidden space-y-3">
        {requirements.length === 0 && (
          <div className="border border-slate-200 rounded-lg px-3 py-6 text-center text-sm text-slate-400">No requirements added yet.</div>
        )}
        {requirements.map((r) => {
          const k = key(r);
          const err = rowErrors && rowErrors[k];
          return (
            <div key={k} className="border border-slate-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Item / Service</label>
                <input className={err && err.item ? inputErrCls : inputCls} value={r.item} onChange={(e) => updateRow(k, "item", e.target.value)} placeholder="e.g. Laptop" maxLength={100} />
                {err && typeof err.item === "string" && <p className="text-[11px] text-red-500 mt-1">{err.item}</p>}
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Description</label>
                <input className={inputCls} value={r.description} onChange={(e) => updateRow(k, "description", e.target.value)} placeholder="Specification / details" maxLength={500} />
                <p className="text-[10px] text-slate-400 mt-0.5 text-right">{r.description.length}/500</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 block">Quantity</label>
                  <input type="number" min="0" className={err && err.quantity ? inputErrCls : inputCls} value={r.quantity} onChange={(e) => updateRow(k, "quantity", e.target.value)} />
                  {err && typeof err.quantity === "string" && <p className="text-[11px] text-red-500 mt-1">{err.quantity}</p>}
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 block">Unit</label>
                  <SearchableSelect value={r.unit} onChange={(v) => updateRow(k, "unit", v)} options={UNITS} clearable={false} searchable={false} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 block">Unit Price</label>
                <input type="number" min="0" className={err && err.unit_price ? inputErrCls : inputCls} value={r.unit_price} onChange={(e) => updateRow(k, "unit_price", e.target.value)} />
                {err && typeof err.unit_price === "string" && <p className="text-[11px] text-red-500 mt-1">{err.unit_price}</p>}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[11px] text-slate-400">Total</p>
                  <p className="text-sm font-semibold text-slate-800">{formatCurrency(requirementTotal(r))}</p>
                </div>
                <button
                  onClick={() => removeRow(k)}
                  disabled={requirements.length <= 1}
                  title={requirements.length <= 1 ? "At least one requirement is required" : "Remove requirement"}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
        <button onClick={addRow} className={btnGhost}><Plus size={14} /> Add Requirement</button>
        <p className="text-sm text-slate-600">Requirement Total: <span className="font-bold text-slate-900">{formatCurrency(total)}</span></p>
      </div>
    </div>
  );
}
