import { useEffect, useState } from "react";
import { Check, Info, Loader2, Package, RotateCcw } from "lucide-react";
import { patchQuotation, replaceRequirements } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { messageFrom } from "../../utils/apiError";
import RequirementsEditor, { requirementsTotal } from "../RequirementsEditor";
import { btnGhostSm, btnPrimary, cardCls, sectionTitleCls } from "../ui";

export default function RequirementsTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState(enquiry.requirements);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => setRows(enquiry.requirements), [enquiry.id, enquiry.requirements]);

  async function handleSave() {
    setSaving(true);
    try {
      await replaceRequirements(enquiry.id, rows.map((r) => ({
        id: r.id, item: r.item, description: r.description, quantity: Number(r.quantity), unit: r.unit, unit_price: Number(r.unit_price),
      })));
      await onChanged();
      showToast("Requirements saved.", "success");
    } catch (err) {
      showToast(messageFrom(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function syncQuotation() {
    setSyncing(true);
    try {
      const total = requirementsTotal(rows);
      const q = enquiry.quotation;
      const taxAmount = Number(q.tax_amount) || Math.round(total * 0.18);
      await patchQuotation(enquiry.id, { value: total, tax_amount: taxAmount });
      await onChanged();
      showToast("Quotation value synced from requirements.", "success");
    } catch (err) {
      showToast(messageFrom(err), "error");
    } finally {
      setSyncing(false);
    }
  }

  const locked = ["Accepted", "Rejected"].includes(enquiry.quotation.status);
  const canSync = enquiry.quotation.status !== "Not Prepared" && !locked;

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={sectionTitleCls + " border-none mb-0 pb-0"}><Package size={15} /> Requirements</h3>
        {canSync && (
          <button onClick={syncQuotation} disabled={syncing} className={btnGhostSm}>
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Recalculate Quotation Value
          </button>
        )}
      </div>
      <div className="border-b border-slate-100 mb-4"></div>
      {["Shared", "Accepted"].includes(enquiry.quotation.status) && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          <Info size={13} /> The quotation for this enquiry has already been shared or accepted. Edit requirements with care — remember to recalculate the quotation value afterward.
        </div>
      )}
      <RequirementsEditor requirements={rows} onChange={setRows} />
      <div className="flex justify-end mt-3">
        <button className={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Requirements
        </button>
      </div>
    </div>
  );
}
