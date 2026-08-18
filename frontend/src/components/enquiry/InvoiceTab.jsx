import { useEffect, useState } from "react";
import { ArrowRight, Receipt, XCircle } from "lucide-react";
import { generateInvoice, patchInvoice } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/format";
import * as v from "../../utils/validators";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import SearchableSelect from "../SearchableSelect";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, cardCls, inputCls, inputErrCls, sectionTitleCls, textareaCls } from "../ui";
import { PAYMENT_STATUSES } from "../../constants";
import InternalDocumentAttachment from "./InternalDocumentAttachment";

// Full literal strings (not template-built) so Tailwind's JIT scanner can find them.
const FIELD_SPAN = "col-span-6 sm:col-span-4 lg:col-span-3";
const subHeadingCls = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3";
// Same height/padding/radius as a real input so read-only (system-set/calculated) values
// line up exactly with editable fields in the grid — just visually muted, not a broken input.
const readOnlyCls = "w-full h-[38px] px-3 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center";

export default function InvoiceTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const inv = enquiry.invoice;
  const o = enquiry.order;
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ invoice_number: inv.invoice_number || "", due_date: inv.due_date || "", remarks: inv.remarks || "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft({ invoice_number: inv.invoice_number || "", due_date: inv.due_date || "", remarks: inv.remarks || "" });
  }, [inv.invoice_number, inv.due_date, inv.remarks]);

  const canGenerate = ["Confirmed", "Partially Confirmed", "Completed"].includes(o.status) && inv.status === "Not Generated";

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

  const generate = () => withBusy(() => generateInvoice(enquiry.id, {}), "Invoice generated.").catch(() => {});
  const setInvoiceStatus = (newStatus, label) => withBusy(() => patchInvoice(enquiry.id, { status: newStatus }), label).catch(() => {});
  const setPaymentStatus = (newStatus) => withBusy(() => patchInvoice(enquiry.id, { payment_status: newStatus }), "Payment status updated.").catch(() => {});

  async function commitField(field, value) {
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    try {
      await withBusy(() => patchInvoice(enquiry.id, { [field]: value }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, ...fieldErrorsFrom(err) }));
    }
  }

  const generatedYesNo = inv.status !== "Not Generated" ? "Yes" : "No";

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={sectionTitleCls + " border-none mb-0 pb-0"}><Receipt size={15} /> Invoice</h3>
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg pl-3 pr-2.5 py-1.5">
          <div className="text-right leading-tight">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Generated</p>
            <p className={`text-xs font-semibold ${generatedYesNo === "Yes" ? "text-green-600" : "text-slate-500"}`}>{generatedYesNo}</p>
          </div>
          <StatusBadge status={inv.status} type="invoice" />
        </div>
      </div>
      <div className="border-b border-slate-100 mb-4"></div>

      {inv.status === "Not Generated" ? (
        <EmptyState
          icon={Receipt}
          title="No invoice generated yet"
          message={canGenerate ? "The order has been confirmed — you can now generate an invoice." : "An invoice can be generated once the order has been confirmed."}
          action={<button className={btnPrimary} disabled={!canGenerate || busy} onClick={generate}><Receipt size={15} /> Generate Invoice</button>}
        />
      ) : (
        <>
          <p className={subHeadingCls}>Invoice Information</p>
          <div className="grid grid-cols-12 gap-x-5 gap-y-4 mb-6">
            <FormField
              className={FIELD_SPAN} label="Invoice Number (Optional)" error={errors.invoice_number}
              hint="Optional — enter the invoice number from your external billing system."
            >
              <input
                className={errors.invoice_number ? inputErrCls : inputCls} value={draft.invoice_number} maxLength={30}
                placeholder="Not provided"
                onChange={(e) => setDraft((d) => ({ ...d, invoice_number: e.target.value }))}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === (inv.invoice_number || "")) return;
                  const err = v.documentNumber(next, "Invoice Number");
                  if (err) { setErrors((prev) => ({ ...prev, invoice_number: err })); return; }
                  commitField("invoice_number", next || null);
                }}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Invoice Date">
              <div className={readOnlyCls}>{formatDate(inv.invoice_date)}</div>
            </FormField>
            <FormField className={FIELD_SPAN} label="Invoice Value">
              <div className={readOnlyCls + " font-semibold text-slate-900"}>{formatCurrency(inv.value)}</div>
            </FormField>
            <FormField className={FIELD_SPAN} label="Due Date" error={errors.due_date}>
              <input
                type="date" className={errors.due_date ? inputErrCls : inputCls} value={draft.due_date}
                onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
                onBlur={(e) => e.target.value !== inv.due_date && commitField("due_date", e.target.value)}
                min={inv.invoice_date || undefined}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Payment Status">
              <SearchableSelect value={inv.payment_status} onChange={setPaymentStatus} options={PAYMENT_STATUSES} clearable={false} searchable={false} />
            </FormField>
            <FormField className={FIELD_SPAN} label="Payment Date">
              <div className={readOnlyCls}>{inv.payment_date ? formatDate(inv.payment_date) : "—"}</div>
            </FormField>
          </div>

          <div className="pt-5 mt-1 border-t border-slate-100">
            <FormField label="Invoice Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
              <textarea
                className={textareaCls} rows={3} maxLength={500} value={draft.remarks}
                onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
                onBlur={(e) => e.target.value !== inv.remarks && commitField("remarks", e.target.value)}
              />
            </FormField>
          </div>

          <InternalDocumentAttachment entityType="invoice" enquiryId={enquiry.id} />

          <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            {inv.status === "Generated" && (
              <>
                <button className={btnDanger} disabled={busy} onClick={() => setInvoiceStatus("Cancelled", "Invoice Cancelled")}><XCircle size={14} /> Cancel Invoice</button>
                <button className={btnPrimary} disabled={busy} onClick={() => setInvoiceStatus("Sent", "Invoice Marked as Sent")}><ArrowRight size={14} /> Mark as Sent</button>
              </>
            )}
            {inv.status === "Sent" && (
              <button className={btnDanger} disabled={busy} onClick={() => setInvoiceStatus("Cancelled", "Invoice Cancelled")}><XCircle size={14} /> Cancel Invoice</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
