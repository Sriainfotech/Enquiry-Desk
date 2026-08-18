import { useEffect, useState } from "react";
import { Check, CheckCircle2, Loader2, Package, XCircle } from "lucide-react";
import { createOrder, patchOrder } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { formatCurrency, formatDate, todayStr } from "../../utils/format";
import * as v from "../../utils/validators";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, inputErrCls, sectionTitleCls, textareaCls } from "../ui";
import InternalDocumentAttachment from "./InternalDocumentAttachment";

// Full literal strings (not template-built) so Tailwind's JIT scanner can find them.
const FIELD_SPAN = "col-span-12 sm:col-span-6 lg:col-span-3";
const subHeadingCls = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3";
// Same height/padding/radius as a real input so read-only (system-set) values line up
// exactly with editable fields in the grid — just visually muted, not a broken input.
const readOnlyCls = "w-full h-[38px] px-3 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center";

export default function OrderTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const o = enquiry.order;
  const q = enquiry.quotation;
  const [showConvert, setShowConvert] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(todayStr());
  const [convertErrors, setConvertErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    order_number: o.order_number || "", po_number: o.po_number || "", po_date: o.po_date || "",
    expected_delivery_date: o.expected_delivery_date || "", remarks: o.remarks || "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft({
      order_number: o.order_number || "", po_number: o.po_number || "", po_date: o.po_date || "",
      expected_delivery_date: o.expected_delivery_date || "", remarks: o.remarks || "",
    });
  }, [o.order_number, o.po_number, o.po_date, o.expected_delivery_date, o.remarks]);

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
    const poNumberErr = v.documentNumber(poNumber, "PO Number");
    if (poNumberErr) errs.po_number = poNumberErr;
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
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg pl-3 pr-2.5 py-1.5">
          <div className="text-right leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Order Confirmed</p>
            <p className={`text-xs font-semibold ${confirmedYesNo === "Yes" ? "text-green-600" : "text-slate-500"}`}>{confirmedYesNo}</p>
          </div>
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
        <div className="space-y-3 mb-4 bg-slate-50 border border-slate-100 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-4">
            <FormField className={FIELD_SPAN} label="PO Number (Optional)" hint="Optional — enter the PO number if you already have it." error={convertErrors.po_number}>
              <input className={convertErrors.po_number ? inputErrCls : inputCls} value={poNumber} onChange={(e) => setPoNumber(e.target.value)} maxLength={30} placeholder="Not provided" />
            </FormField>
            <FormField className={FIELD_SPAN} label="PO Date" error={convertErrors.po_date}>
              <input type="date" className={convertErrors.po_date ? inputErrCls : inputCls} value={poDate} onChange={(e) => setPoDate(e.target.value)} max={todayStr()} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className={btnSecondary} onClick={() => setShowConvert(false)}>Cancel</button>
            <button className={btnPrimary} onClick={convert} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm Conversion
            </button>
          </div>
        </div>
      )}

      {o.status !== "Not Converted" && (
        <>
          <p className={subHeadingCls}>Order Information</p>
          <div className="grid grid-cols-12 gap-x-5 gap-y-4 mb-6">
            <FormField
              className={FIELD_SPAN} label="Order Number (Optional)" error={errors.order_number}
              hint="Optional — enter the order number from your external system."
            >
              <input
                className={errors.order_number ? inputErrCls : inputCls} value={draft.order_number} maxLength={30}
                placeholder="Not provided"
                onChange={(e) => setDraft((d) => ({ ...d, order_number: e.target.value }))}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === (o.order_number || "")) return;
                  const err = v.documentNumber(next, "Order Number");
                  if (err) { setErrors((prev) => ({ ...prev, order_number: err })); return; }
                  commitField("order_number", next || null);
                }}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Order Date">
              <div className={readOnlyCls}>{formatDate(o.order_date)}</div>
            </FormField>
            <FormField
              className={FIELD_SPAN} label="PO Number (Optional)" error={errors.po_number}
              hint="Optional — enter the PO number from your external system."
            >
              <input
                className={errors.po_number ? inputErrCls : inputCls} value={draft.po_number} maxLength={30}
                placeholder="Not provided"
                onChange={(e) => setDraft((d) => ({ ...d, po_number: e.target.value }))}
                onBlur={(e) => {
                  if (e.target.value === o.po_number) return;
                  const err = v.documentNumber(e.target.value, "PO Number");
                  if (err) { setErrors((prev) => ({ ...prev, po_number: err })); return; }
                  commitField("po_number", e.target.value.trim());
                }}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="PO Date" error={errors.po_date}>
              <input
                type="date" className={errors.po_date ? inputErrCls : inputCls} value={draft.po_date}
                onChange={(e) => setDraft((d) => ({ ...d, po_date: e.target.value }))}
                onBlur={(e) => e.target.value !== o.po_date && commitField("po_date", e.target.value)}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Order Value">
              <div className={readOnlyCls + " font-semibold text-slate-900"}>{formatCurrency(o.value)}</div>
            </FormField>
            <FormField className={FIELD_SPAN} label="Expected Delivery Date" error={errors.expected_delivery_date}>
              <input
                type="date" className={errors.expected_delivery_date ? inputErrCls : inputCls} value={draft.expected_delivery_date}
                onChange={(e) => setDraft((d) => ({ ...d, expected_delivery_date: e.target.value }))}
                onBlur={(e) => e.target.value !== o.expected_delivery_date && commitField("expected_delivery_date", e.target.value)}
                min={o.order_date || undefined}
              />
            </FormField>
          </div>

          <div className="pt-5 mt-1 border-t border-slate-100">
            <FormField label="Order Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
              <textarea
                className={textareaCls} rows={3} maxLength={500} value={draft.remarks}
                onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
                onBlur={(e) => e.target.value !== o.remarks && commitField("remarks", e.target.value)}
              />
            </FormField>
          </div>

          <InternalDocumentAttachment entityType="order" enquiryId={enquiry.id} />

          <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            {o.status === "Pending" && (
              <>
                <button className={btnDanger} disabled={busy} onClick={() => setStatus("Cancelled", "Order Cancelled")}><XCircle size={14} /> Cancel Order</button>
                <button className={btnSecondary} disabled={busy} onClick={() => setStatus("Partially Confirmed", "Order Partially Confirmed")}>Mark as Partially Confirmed</button>
                <button className={btnPrimary} disabled={busy} onClick={() => setStatus("Confirmed", "Order Confirmed")}><CheckCircle2 size={14} /> Mark as Confirmed</button>
              </>
            )}
            {(o.status === "Confirmed" || o.status === "Partially Confirmed") && (
              <>
                <button className={btnDanger} disabled={busy} onClick={() => setStatus("Cancelled", "Order Cancelled")}><XCircle size={14} /> Cancel Order</button>
                <button className={btnPrimary} disabled={busy} onClick={() => setStatus("Completed", "Order Marked as Completed")}><CheckCircle2 size={14} /> Mark as Completed</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
