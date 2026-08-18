import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2, Clock, FileText, Loader2, Plus, RotateCcw, XCircle } from "lucide-react";
import { createQuotation, patchQuotation } from "../../api/enquiries";
import { requirementsTotal } from "../RequirementsEditor";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { addDays, formatCurrency, formatDate, todayStr } from "../../utils/format";
import * as v from "../../utils/validators";
import EmptyState from "../EmptyState";
import FormField from "../FormField";
import SearchableSelect from "../SearchableSelect";
import StatusBadge from "../StatusBadge";
import { btnDanger, btnPrimary, btnSecondary, cardCls, inputCls, inputErrCls, sectionTitleCls, textareaCls } from "../ui";
import InternalDocumentAttachment from "./InternalDocumentAttachment";

// Full literal strings (not template-built) so Tailwind's JIT scanner can find them.
const FIELD_SPAN = "col-span-12 sm:col-span-6 lg:col-span-3";
const subHeadingCls = "text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3";
// Same height/padding/radius as a real input so read-only (system-set/calculated) values
// line up exactly with editable fields in the grid — just visually muted, not a broken input.
const readOnlyCls = "w-full h-[38px] px-3 border border-slate-200 rounded-md bg-slate-50 text-sm text-slate-700 flex items-center";

export default function QuotationTab({ enquiry, onChanged }) {
  const { showToast } = useToast();
  const q = enquiry.quotation;
  const [showCreate, setShowCreate] = useState(false);
  // Tax is optional — blank (not a guessed rate) is the default; empty means ₹0, not "unset".
  const [taxAmount, setTaxAmount] = useState("");
  const [validUntil, setValidUntil] = useState(addDays(todayStr(), 15));
  const [createErrors, setCreateErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // Tax is optional — a stored 0 reads as "no tax entered", so the input shows blank
  // rather than a literal 0, matching how the create step treats an empty tax field.
  const taxAmountDisplay = (val) => (Number(val) ? val : "");
  const [draft, setDraft] = useState({
    quotation_number: q.quotation_number || "", value: q.value, tax_amount: taxAmountDisplay(q.tax_amount),
    valid_until: q.valid_until || "", quotation_shared: q.quotation_shared, remarks: q.remarks || "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setDraft({
      quotation_number: q.quotation_number || "", value: q.value, tax_amount: taxAmountDisplay(q.tax_amount),
      valid_until: q.valid_until || "", quotation_shared: q.quotation_shared, remarks: q.remarks || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.quotation_number, q.value, q.tax_amount, q.valid_until, q.quotation_shared, q.remarks]);

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
    const taxErr = v.optionalMoney(taxAmount, "Tax Amount");
    if (taxErr) errs.tax_amount = taxErr;
    if (!validUntil) errs.valid_until = "Valid Until is required.";
    else if (validUntil < todayStr()) errs.valid_until = "Valid Until cannot be earlier than today.";
    setCreateErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      await withBusy(async () => {
        await createQuotation(enquiry.id, { tax_amount: taxAmount === "" ? null : taxAmount, valid_until: validUntil });
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
        <div className="space-y-3 mb-4 bg-slate-50 border border-slate-100 rounded-lg p-4">
          <div className="grid grid-cols-12 gap-4">
            <FormField className={FIELD_SPAN} label="Tax Amount (Optional)" hint="Optional — leave blank for no tax." error={createErrors.tax_amount}>
              <input
                type="number" min="0" placeholder="0.00"
                className={createErrors.tax_amount ? inputErrCls : inputCls} value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Valid Until" error={createErrors.valid_until}>
              <input type="date" className={createErrors.valid_until ? inputErrCls : inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} min={todayStr()} />
            </FormField>
          </div>

          <div className="text-sm space-y-1 max-w-[220px]">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(requirementsTotal(enquiry.requirements))}</span></div>
            <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(taxAmount === "" ? 0 : taxAmount)}</span></div>
            <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-200">
              <span>Grand Total</span><span>{formatCurrency(requirementsTotal(enquiry.requirements) + (taxAmount === "" ? 0 : Number(taxAmount) || 0))}</span>
            </div>
          </div>

          <InternalDocumentAttachment entityType="quotation" enquiryId={enquiry.id} />

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
            <button className={btnSecondary} onClick={() => setShowCreate(false)}>Cancel</button>
            <button className={btnPrimary} onClick={createQ} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save Quotation
            </button>
          </div>
        </div>
      )}

      {q.status !== "Not Prepared" && (
        <>
          <p className={subHeadingCls}>Quotation Information</p>
          <div className="grid grid-cols-12 gap-x-5 gap-y-4 mb-6">
            <FormField
              className={FIELD_SPAN} label="Quotation Number (Optional)" error={errors.quotation_number}
              hint="Optional — enter the quotation number from your external system."
            >
              <input
                className={errors.quotation_number ? inputErrCls : inputCls} value={draft.quotation_number} maxLength={30}
                placeholder="Not provided"
                onChange={(e) => setDraft((d) => ({ ...d, quotation_number: e.target.value }))}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === (q.quotation_number || "")) return;
                  const err = v.documentNumber(next, "Quotation Number");
                  if (err) { setErrors((prev) => ({ ...prev, quotation_number: err })); return; }
                  commitField("quotation_number", next || null);
                }}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Quotation Date">
              <div className={readOnlyCls}>{formatDate(q.quotation_date)}</div>
            </FormField>
            <FormField className={FIELD_SPAN} label="Quotation Value" error={errors.value}>
              <input
                type="number" min="0" className={errors.value ? inputErrCls : inputCls} disabled={locked}
                value={draft.value}
                onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                onBlur={(e) => Number(e.target.value) !== Number(q.value) && commitField("value", Number(e.target.value))}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Tax Amount (Optional)" hint="Optional — leave blank for no tax." error={errors.tax_amount}>
              <input
                type="number" min="0" placeholder="0.00"
                className={errors.tax_amount ? inputErrCls : inputCls} disabled={locked}
                value={draft.tax_amount}
                onChange={(e) => setDraft((d) => ({ ...d, tax_amount: e.target.value }))}
                onBlur={(e) => {
                  const next = e.target.value === "" ? 0 : Number(e.target.value);
                  if (next !== Number(q.tax_amount)) commitField("tax_amount", next);
                }}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Total Value">
              <div className={readOnlyCls + " font-semibold text-slate-900"}>{formatCurrency(q.total_value)}</div>
            </FormField>
            <FormField className={FIELD_SPAN} label="Valid Until" error={errors.valid_until}>
              <input
                type="date" className={errors.valid_until ? inputErrCls : inputCls}
                value={draft.valid_until}
                onChange={(e) => setDraft((d) => ({ ...d, valid_until: e.target.value }))}
                onBlur={(e) => e.target.value !== q.valid_until && commitField("valid_until", e.target.value)}
              />
            </FormField>
            <FormField className={FIELD_SPAN} label="Quotation Shared" error={errors.quotation_shared}>
              <SearchableSelect
                value={draft.quotation_shared ? "Yes" : "No"}
                onChange={(v) => {
                  const shared = v === "Yes";
                  setDraft((d) => ({ ...d, quotation_shared: shared }));
                  commitField("quotation_shared", shared);
                }}
                options={["Yes", "No"]}
                clearable={false}
                searchable={false}
              />
            </FormField>
          </div>

          <div className="pt-5 mt-1 border-t border-slate-100">
            <FormField label="Quotation Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
              <textarea
                className={textareaCls} rows={3} maxLength={500}
                value={draft.remarks}
                onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))}
                onBlur={(e) => e.target.value !== q.remarks && commitField("remarks", e.target.value)}
              />
            </FormField>
          </div>

          <InternalDocumentAttachment entityType="quotation" enquiryId={enquiry.id} />

          <div className="flex flex-wrap items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            {q.status === "Draft" && (
              <button className={btnPrimary} disabled={busy} onClick={() => transition("Prepared", "Quotation Marked as Prepared")}><Check size={14} /> Mark as Prepared</button>
            )}
            {q.status === "Prepared" && (
              <button className={btnPrimary} disabled={busy} onClick={() => transition("Shared", "Quotation Shared with Customer")}><ArrowRight size={14} /> Mark as Shared</button>
            )}
            {q.status === "Shared" && (
              <>
                <button className={btnDanger} disabled={busy} onClick={() => transition("Rejected", "Quotation Rejected")}><XCircle size={14} /> Mark as Rejected</button>
                <button className={btnSecondary} disabled={busy} onClick={() => transition("Expired", "Quotation Expired")}><Clock size={14} /> Mark as Expired</button>
                <button className={btnPrimary} disabled={busy} onClick={() => transition("Accepted", "Quotation Accepted")}><CheckCircle2 size={14} /> Mark as Accepted</button>
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
