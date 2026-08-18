import { useState } from "react";
import { Building2, Check, ClipboardList, Loader2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { patchEnquiry } from "../../api/enquiries";
import { useToast } from "../../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../../utils/apiError";
import { formatDate } from "../../utils/format";
import * as v from "../../utils/validators";
import FormField from "../FormField";
import SearchableSelect from "../SearchableSelect";
import { btnPrimary, btnSecondary, cardCls, inputCls, inputErrCls, sectionTitleCls, textareaCls } from "../ui";
import { BUSINESS_LINES, ENQUIRY_SOURCES, PRIORITIES } from "../../constants";

export default function OverviewTab({ enquiry, customer, startEdit, onChanged }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(!!startEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [draft, setDraft] = useState({
    business_line: enquiry.business_line,
    enquiry_source: enquiry.enquiry_source,
    priority: enquiry.priority,
    sales_person: enquiry.sales_person,
    expected_closing_date: enquiry.expected_closing_date || "",
    remarks: enquiry.remarks,
  });

  async function save() {
    const errs = {};
    const salesErr = v.salesPerson(draft.sales_person);
    if (salesErr) errs.sales_person = salesErr;
    const remarksErr = v.maxLen(draft.remarks, 500, "Remarks");
    if (remarksErr) errs.remarks = remarksErr;
    const dateErr = v.dateNotBefore(draft.expected_closing_date, enquiry.enquiry_date, "Expected Closing Date", "Date of Enquiry");
    if (dateErr) errs.expected_closing_date = dateErr;
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await patchEnquiry(enquiry.id, draft);
      await onChanged();
      setEditing(false);
      showToast("Enquiry details updated.", "success");
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      if (Object.keys(fieldErrs).length) setErrors(fieldErrs);
      else showToast(messageFrom(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className={`${cardCls} p-5`}>
        <h3 className={sectionTitleCls}><Building2 size={15} /> Customer Details</h3>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Company</span><button onClick={() => navigate(`/customers/${customer.id}`)} className="text-teal-700 font-medium hover:underline">{customer.company_name}</button></div>
          <div className="flex justify-between"><span className="text-slate-500">Contact Person</span><span className="text-slate-800">{customer.contact_person}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Mobile</span><span className="text-slate-800">{customer.mobile}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Email</span><span className="text-slate-800">{customer.email}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">GST Number</span><span className="text-slate-800 font-mono text-xs">{customer.gst_number || "—"}</span></div>
        </div>
      </div>

      <div className={`${cardCls} p-5`}>
        <div className="flex items-center justify-between">
          <h3 className={sectionTitleCls + " border-none mb-0 pb-0"}><ClipboardList size={15} /> Enquiry Details</h3>
          {!editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"><Pencil size={12} /> Edit</button>}
        </div>
        <div className="border-b border-slate-100 mb-3"></div>
        {!editing ? (
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Business Line</span><span className="text-slate-800">{enquiry.business_line}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Enquiry Source</span><span className="text-slate-800">{enquiry.enquiry_source || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Priority</span><span className="text-slate-800">{enquiry.priority}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sales Person</span><span className="text-slate-800">{enquiry.sales_person || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Date of Enquiry</span><span className="text-slate-800">{formatDate(enquiry.enquiry_date)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Expected Closing</span><span className="text-slate-800">{formatDate(enquiry.expected_closing_date)}</span></div>
            {enquiry.remarks && <div className="pt-2 border-t border-slate-100"><span className="text-slate-500 text-xs">Remarks</span><p className="text-slate-700 mt-1">{enquiry.remarks}</p></div>}
          </div>
        ) : (
          <div className="space-y-3">
            <FormField label="Business Line">
              <SearchableSelect value={draft.business_line} onChange={(v) => setDraft((d) => ({ ...d, business_line: v }))} placeholder="Select business line" options={BUSINESS_LINES} clearable={false} />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Enquiry Source">
                <SearchableSelect value={draft.enquiry_source} onChange={(v) => setDraft((d) => ({ ...d, enquiry_source: v }))} placeholder="Select source" options={ENQUIRY_SOURCES} />
              </FormField>
              <FormField label="Priority">
                <SearchableSelect value={draft.priority} onChange={(v) => setDraft((d) => ({ ...d, priority: v }))} placeholder="Select priority" options={PRIORITIES} clearable={false} />
              </FormField>
              <FormField label="Sales Person" error={errors.sales_person} counter={{ value: draft.sales_person.length, max: 50 }}>
                <input className={errors.sales_person ? inputErrCls : inputCls} value={draft.sales_person} onChange={(e) => setDraft((d) => ({ ...d, sales_person: e.target.value }))} maxLength={50} />
              </FormField>
              <FormField label="Expected Closing" error={errors.expected_closing_date}>
                <input type="date" className={errors.expected_closing_date ? inputErrCls : inputCls} value={draft.expected_closing_date} onChange={(e) => setDraft((d) => ({ ...d, expected_closing_date: e.target.value }))} min={enquiry.enquiry_date} />
              </FormField>
            </div>
            <FormField label="Remarks" error={errors.remarks} counter={{ value: draft.remarks.length, max: 500 }}>
              <textarea className={textareaCls} rows={2} value={draft.remarks} onChange={(e) => setDraft((d) => ({ ...d, remarks: e.target.value }))} maxLength={500} />
            </FormField>
            <div className="flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>
              <button className={btnPrimary} onClick={save} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
