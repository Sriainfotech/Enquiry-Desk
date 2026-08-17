import { useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2, Package, XCircle } from "lucide-react";
import { createOrder, patchOrder } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { formatCurrency, formatDate, todayStr } from "../../utils/format";
import Code from "../Code";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, inputErrCls, labelCls, sectionTitleCls, textareaCls } from "../ui";

export default function OrderTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const o = enquiry.order;
  const q = enquiry.quotation;
  const [showConvert, setShowConvert] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(todayStr());
  const [convertErrors, setConvertErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ po_number: o.po_number || "", po_date: o.po_date || "", remarks: o.remarks || "" });
  const [errors, setErrors] = useState({});

  useEffect(() => setDraft({ po_number: o.po_number || "", po_date: o.po_date || "", remarks: o.remarks || "" }), [o.po_number, o.po_date, o.remarks]);

  const canConvert = q.status === "Accepted" && o.status === "Not Converted";

  async function withBusy(fn, successMessage) {
    setBusy(true);
    try {
      await fn();
      await onChanged();
      if (successMessage) showToast(successMessage, "success");
    } catch (err) {
      showToast(messageFrom(err), "error");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    const errs = {};
    if (poNumber.length > 50) errs.po_number = "PO Number cannot exceed 50 characters.";
    if (poDate && poDate > todayStr()) errs.po_date = "PO Date cannot be later than today.";
    setConvertErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withBusy(async () => {
        await createOrder(enquiry.id, { po_number: poNumber, po_date: poDate });
        setShowConvert(false);
      }, "Enquiry converted to order.");
    } catch (err) {
      setConvertErrors(fieldErrorsFrom(err));
    }
  }

  const setStatus = (newStatus, label) => withBusy(() => patchOrder(enquiry.id, { status: newStatus }), label).catch(() => {});

  async function commitField(field, value) {
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    try {
      await withBusy(() => patchOrder(enquiry.id, { [field]: value }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, ...fieldErrorsFrom(err) }));
    }
  }

  const confirmedYesNo = ["Confirmed", "Completed"].includes(o.status) ? "Yes" : "No";

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={sectionTitleCls + " border-none mb-0 pb-0"}><Package size={15} /> Order</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Order Confirmed: <span className={`font-semibold ${confirmedYesNo === "Yes" ? "text-green-600" : "text-slate-500"}`}>{confirmedYesNo}</span></span>
          <StatusBadge status={o.status} type="order" />
        </div>
      </div>
      <div className="border-b border-slate-100 mb-4"></div>

      {o.status === "Not Converted" && !showConvert && (
        <EmptyState
          icon={Package}
          title="Enquiry not yet converted to an order"
          message={q.status === "Accepted" ? "The quotation has been accepted — you can now convert this enquiry to an order." : "An order can be created once the quotation has been accepted by the customer."}
          action={<button className={btnPrimary} disabled={!canConvert} onClick={() => setShowConvert(true)}><Package size={15} /> Convert to Order</button>}
        />
      )}

      {showConvert && (
        <div className="max-w-md space-y-3 mb-4 bg-slate-50 border border-slate-100 rounded-lg p-4">
          <div className="flex flex-wrap gap-3">
            <FormField className="w-[220px]" label="PO Number" hint="Optional" error={convertErrors.po_number}>
              <input className={convertErrors.po_number ? inputErrCls : inputCls} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} maxLength={50} />
            </FormField>
            <FormField className="w-[180px]" label="PO Date" error={convertErrors.po_date}>
              <input type="date" className={convertErrors.po_date ? inputErrCls : inputCls} value={poDate} onChange={(e) => setPoDate(e.target.value)} max={todayStr()} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowConvert(false)}>Cancel</button>
            <button className={btnPrimary} onClick={convert} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm Conversion
            </button>
          </div>
        </div>
      )}

      {o.status !== "Not Converted" && (
        <>
          <div className="flex flex-wrap gap-4 mb-5">
            <div className="w-[190px]"><p className={labelCls}>Order Number</p><Code>{o.order_number}</Code></div>
            <div className="w-[160px]"><p className={labelCls}>Order Date</p><p className="text-sm text-slate-800">{formatDate(o.order_date)}</p></div>
            <FormField className="w-[220px]" label="PO Number" error={errors.po_number}>
              <input
                className={errors.po_number ? inputErrCls : inputCls} value={draft.po_number} maxLength={50}
                onChange={(e) => setDraft((d) => ({ ...d, po_number: e.target.value }))}
                onBlur={(e) => e.target.value !== o.po_number && commitField("po_number", e.target.value)}
              />
            </FormField>
            <FormField className="w-[180px]" label="PO Date" error={errors.po_date}>
              <input
                type="date" className={errors.po_date ? inputErrCls : inputCls} value={draft.po_date}
                onChange={(e) => setDraft((d) => ({ ...d, po_date: e.target.value }))}
                onBlur={(e) => e.target.value !== o.po_date && commitField("po_date", e.target.value)}
              />
            </FormField>
            <div className="w-[160px]"><p className={labelCls}>Order Value</p><p className="text-sm font-bold text-slate-900 h-[38px] flex items-center">{formatCurrency(o.value)}</p></div>
          </div>
          <FormField label="Order Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
            <textarea
              className={textareaCls} rows={2} maxLength={500} value={draft.remarks}
              onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
              onBlur={(e) => e.target.value !== o.remarks && commitField("remarks", e.target.value)}
            />
          </FormField>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {o.status === "Pending" && (
              <>
                <button className={btnPrimary} disabled={busy} onClick={() => setStatus("Confirmed", "Order Confirmed")}><CheckCircle2 size={14} /> Mark as Confirmed</button>
                <button className={btnSecondary} disabled={busy} onClick={() => setStatus("Partially Confirmed", "Order Partially Confirmed")}>Mark as Partially Confirmed</button>
                <button className={btnDanger} disabled={busy} onClick={() => setStatus("Cancelled", "Order Cancelled")}><XCircle size={14} /> Cancel Order</button>
              </>
            )}
            {(o.status === "Confirmed" || o.status === "Partially Confirmed") && (
              <>
                <button className={btnPrimary} disabled={busy} onClick={() => setStatus("Completed", "Order Marked as Completed")}><CheckCircle2 size={14} /> Mark as Completed</button>
                <button className={btnDanger} disabled={busy} onClick={() => setStatus("Cancelled", "Order Cancelled")}><XCircle size={14} /> Cancel Order</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
