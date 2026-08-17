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
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
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
                  </td>
                  <td className="px-2 py-2">
                    <input className={inputCls} value={r.description} onChange={(e) => updateRow(k, "description", e.target.value)} placeholder="Specification / details" maxLength={500} />
                    <p className="text-[10px] text-slate-400 mt-0.5 text-right">{r.description.length}/500</p>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" className={err && err.quantity ? inputErrCls : inputCls} value={r.quantity} onChange={(e) => updateRow(k, "quantity", e.target.value)} />
                  </td>
                  <td className="px-2 py-2">
                    <SearchableSelect value={r.unit} onChange={(v) => updateRow(k, "unit", v)} options={UNITS} clearable={false} searchable={false} />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min="0" className={(err && err.unit_price ? inputErrCls : inputCls) + " text-right"} value={r.unit_price} onChange={(e) => updateRow(k, "unit_price", e.target.value)} />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800 whitespace-nowrap pt-[9px]">{formatCurrency(requirementTotal(r))}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(k)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3">
        <button onClick={addRow} className={btnGhost}><Plus size={14} /> Add Requirement</button>
        <p className="text-sm text-slate-600">Requirement Total: <span className="font-bold text-slate-900">{formatCurrency(total)}</span></p>
      </div>
    </div>
  );
}
