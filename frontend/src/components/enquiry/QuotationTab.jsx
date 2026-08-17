import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock, FileText, Loader2, Plus, RotateCcw, XCircle } from "lucide-react";
import { createQuotation, patchQuotation } from "../../api/enquiries";
import { requirementsTotal } from "../RequirementsEditor";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { addDays, formatCurrency, formatDate, todayStr } from "../../utils/format";
import * as v from "../../utils/validators";
import Code from "../Code";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, inputErrCls, labelCls, sectionTitleCls, textareaCls } from "../ui";

export default function QuotationTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const q = enquiry.quotation;
  const [showCreate, setShowCreate] = useState(false);
  const [taxAmount, setTaxAmount] = useState(Math.round(requirementsTotal(enquiry.requirements) * 0.18));
  const [validUntil, setValidUntil] = useState(addDays(todayStr(), 15));
  const [createErrors, setCreateErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ value: q.value, tax_amount: q.tax_amount, valid_until: q.valid_until || "", remarks: q.remarks || "" });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft({ value: q.value, tax_amount: q.tax_amount, valid_until: q.valid_until || "", remarks: q.remarks || "" });
  }, [q.value, q.tax_amount, q.valid_until, q.remarks]);

  const locked = ["Accepted", "Rejected"].includes(q.status);

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

  async function createQ() {
    const errs = {};
    const taxErr = v.money(taxAmount, "Tax Amount");
    if (taxErr) errs.tax_amount = taxErr;
    if (!validUntil) errs.valid_until = "Valid Until is required.";
    else if (validUntil < todayStr()) errs.valid_until = "Valid Until cannot be earlier than today.";
    setCreateErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withBusy(async () => {
        await createQuotation(enquiry.id, { tax_amount: taxAmount, valid_until: validUntil });
        setShowCreate(false);
      }, "Quotation created.");
    } catch (err) {
      setCreateErrors(fieldErrorsFrom(err));
    }
  }

  const transition = (newStatus, label) => withBusy(() => patchQuotation(enquiry.id, { status: newStatus }), label).catch(() => {});

  async function commitField(field, value) {
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    try {
      await withBusy(() => patchQuotation(enquiry.id, { [field]: value }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, ...fieldErrorsFrom(err) }));
    }
  }

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={sectionTitleCls + " border-none mb-0 pb-0"}><FileText size={15} /> Quotation</h3>
        <StatusBadge status={q.status} type="quotation" />
      </div>
      <div className="border-b border-slate-100 mb-4"></div>

      {q.status === "Not Prepared" && !showCreate && (
        <EmptyState
          icon={FileText}
          title="No quotation prepared yet"
          message="Create a quotation based on the requirements added to this enquiry."
          action={<button className={btnPrimary} onClick={() => setShowCreate(true)}><Plus size={15} /> Create Quotation</button>}
        />
      )}

      {showCreate && (
        <div className="max-w-md space-y-3 mb-4 bg-slate-50 border border-slate-100 rounded-lg p-4">
          <p className="text-sm text-slate-600">Requirement total: <span className="font-semibold text-slate-900">{formatCurrency(requirementsTotal(enquiry.requirements))}</span></p>
          <div className="flex flex-wrap gap-3">
            <FormField className="w-[190px]" label="Tax Amount" error={createErrors.tax_amount}>
              <input type="number" min="0" className={createErrors.tax_amount ? inputErrCls : inputCls} value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </FormField>
            <FormField className="w-[180px]" label="Valid Until" error={createErrors.valid_until}>
              <input type="date" className={createErrors.valid_until ? inputErrCls : inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} min={todayStr()} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className={btnPrimary} onClick={createQ} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Quotation
            </button>
          </div>
        </div>
      )}

      {q.status !== "Not Prepared" && (
        <>
          <div className="flex flex-wrap gap-4 mb-5">
            <div className="w-[190px]"><p className={labelCls}>Quotation Number</p><Code>{q.quotation_number}</Code></div>
            <div className="w-[160px]"><p className={labelCls}>Quotation Date</p><p className="text-sm text-slate-800">{formatDate(q.quotation_date)}</p></div>
            <FormField className="w-[190px]" label="Quotation Value" error={errors.value}>
              <input
                type="number" min="0" className={errors.value ? inputErrCls : inputCls} disabled={locked}
                value={draft.value}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                onBlur={(e) => Number(e.target.value) !== Number(q.value) && commitField("value", Number(e.target.value))}
              />
            </FormField>
            <FormField className="w-[190px]" label="Tax Amount" error={errors.tax_amount}>
              <input
                type="number" min="0" className={errors.tax_amount ? inputErrCls : inputCls} disabled={locked}
                value={draft.tax_amount}
                onChange={(e) => setDraft((d) => ({ ...d, tax_amount: e.target.value }))}
                onBlur={(e) => Number(e.target.value) !== Number(q.tax_amount) && commitField("tax_amount", Number(e.target.value))}
              />
            </FormField>
            <div className="w-[160px]"><p className={labelCls}>Total Value</p><p className="text-sm font-bold text-slate-900 h-[38px] flex items-center">{formatCurrency(q.total_value)}</p></div>
            <FormField className="w-[180px]" label="Valid Until" error={errors.valid_until}>
              <input
                type="date" className={errors.valid_until ? inputErrCls : inputCls}
                value={draft.valid_until}
                onChange={(e) => setDraft((d) => ({ ...d, valid_until: e.target.value }))}
                onBlur={(e) => e.target.value !== q.valid_until && commitField("valid_until", e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Quotation Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
            <textarea
              className={textareaCls} rows={2} maxLength={500}
              value={draft.remarks}
              onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
              onBlur={(e) => e.target.value !== q.remarks && commitField("remarks", e.target.value)}
            />
          </FormField>

          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
            {q.status === "Draft" && (
              <button className={btnPrimary} disabled={busy} onClick={() => transition("Prepared", "Quotation Marked as Prepared")}><Check size={14} /> Mark as Prepared</button>
            )}
            {q.status === "Prepared" && (
              <button className={btnPrimary} disabled={busy} onClick={() => transition("Shared", "Quotation Shared with Customer")}><ArrowRight size={14} /> Mark as Shared</button>
            )}
            {q.status === "Shared" && (
              <>
                <button className={btnPrimary} disabled={busy} onClick={() => transition("Accepted", "Quotation Accepted")}><CheckCircle2 size={14} /> Mark as Accepted</button>
                <button className={btnDanger} disabled={busy} onClick={() => transition("Rejected", "Quotation Rejected")}><XCircle size={14} /> Mark as Rejected</button>
                <button className={btnSecondary} disabled={busy} onClick={() => transition("Expired", "Quotation Expired")}><Clock size={14} /> Mark as Expired</button>
              </>
            )}
            {["Rejected", "Expired"].includes(q.status) && (
              <button
                className={btnSecondary}
                disabled={busy}
                onClick={() => withBusy(() => createQuotation(enquiry.id, { tax_amount: q.tax_amount, valid_until: addDays(todayStr(), 15) }), "Revised quotation created (Draft).").catch(() => {})}
              >
                <RotateCcw size={14} /> Create Revised Quotation
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
