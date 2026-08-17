import { useEffect, useState } from "react";
import { ArrowRight, Receipt, XCircle } from "lucide-react";
import { generateInvoice, patchInvoice } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { formatCurrency, formatDate } from "../../utils/format";
import Code from "../Code";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import SearchableSelect from "../SearchableSelect";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, cardCls, inputCls, inputErrCls, labelCls, sectionTitleCls, textareaCls } from "../ui";
import { PAYMENT_STATUSES } from "../../constants";

export default function InvoiceTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const inv = enquiry.invoice;
  const o = enquiry.order;
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ due_date: inv.due_date || "", remarks: inv.remarks || "" });
  const [errors, setErrors] = useState({});

  useEffect(() => setDraft({ due_date: inv.due_date || "", remarks: inv.remarks || "" }), [inv.due_date, inv.remarks]);

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Invoice Generated: <span className={`font-semibold ${generatedYesNo === "Yes" ? "text-green-600" : "text-slate-500"}`}>{generatedYesNo}</span></span>
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
          <div className="flex flex-wrap gap-4 mb-5">
            <div className="w-[190px]"><p className={labelCls}>Invoice Number</p><Code>{inv.invoice_number}</Code></div>
            <div className="w-[160px]"><p className={labelCls}>Invoice Date</p><p className="text-sm text-slate-800">{formatDate(inv.invoice_date)}</p></div>
            <div className="w-[160px]"><p className={labelCls}>Invoice Value</p><p className="text-sm font-bold text-slate-900 h-[38px] flex items-center">{formatCurrency(inv.value)}</p></div>
            <FormField className="w-[180px]" label="Due Date" error={errors.due_date}>
              <input
                type="date" className={errors.due_date ? inputErrCls : inputCls} value={draft.due_date}
                onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
                onBlur={(e) => e.target.value !== inv.due_date && commitField("due_date", e.target.value)}
                min={inv.invoice_date || undefined}
              />
            </FormField>
            <div className="w-[190px]">
              <p className={labelCls}>Payment Status</p>
              <SearchableSelect value={inv.payment_status} onChange={setPaymentStatus} options={PAYMENT_STATUSES} clearable={false} searchable={false} />
            </div>
            <div className="w-[160px]"><p className={labelCls}>Payment Date</p><p className="text-sm text-slate-800 h-[38px] flex items-center">{formatDate(inv.payment_date)}</p></div>
          </div>
          <FormField label="Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
            <textarea
              className={textareaCls} rows={2} maxLength={500} value={draft.remarks}
              onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
              onBlur={(e) => e.target.value !== inv.remarks && commitField("remarks", e.target.value)}
            />
          </FormField>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {inv.status === "Generated" && (
              <>
                <button className={btnPrimary} disabled={busy} onClick={() => setInvoiceStatus("Sent", "Invoice Marked as Sent")}><ArrowRight size={14} /> Mark as Sent</button>
                <button className={btnDanger} disabled={busy} onClick={() => setInvoiceStatus("Cancelled", "Invoice Cancelled")}><XCircle size={14} /> Cancel Invoice</button>
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
