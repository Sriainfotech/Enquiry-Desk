import { useState } from "react";
import { Check } from "lucide-react";
import { createCustomer } from "../api/customers";
import { fieldErrorsFrom, messageFrom } from "../utils/apiError";
import FormField from "./FormField";
import Modal from "./Modal";
import { btnPrimary, btnSecondary, inputCls, inputErrCls, textareaCls } from "./ui";

export default function QuickAddCustomerModal({ onClose, onCreated, showToast, prefillName }) {
  const [draft, setDraft] = useState({
    company_name: prefillName || "", gst_number: "", contact_person: "", mobile: "", email: "", address_line_1: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (f) => (e) => setDraft((d) => ({ ...d, [f]: e.target.value }));

  function validateClientSide() {
    const errs = {};
    if (!draft.company_name.trim()) errs.company_name = "Company name is required.";
    if (!draft.contact_person.trim()) errs.contact_person = "Contact person is required.";
    if (!draft.mobile.trim()) errs.mobile = "Mobile number is required.";
    if (!draft.email.trim()) errs.email = "Email is required.";
    return errs;
  }

  async function handleSave() {
    const clientErrs = validateClientSide();
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      showToast("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await createCustomer(draft);
      showToast(`${saved.company_name} created and selected.`, "success");
      onCreated(saved);
      onClose();
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      if (Object.keys(fieldErrs).length) {
        setErrors(fieldErrs);
        showToast("Please fix the highlighted fields.", "error");
      } else {
        showToast(messageFrom(err), "error");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add New Customer" description="This customer will be added to your master list and selected for this enquiry." onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Company Name" required error={errors.company_name}>
          <input className={errors.company_name ? inputErrCls : inputCls} value={draft.company_name} onChange={set("company_name")} placeholder="Enter company name" autoFocus />
        </FormField>
        <FormField label="GST Number" error={errors.gst_number} hint="Leave blank if not available">
          <input className={errors.gst_number ? inputErrCls : inputCls} value={draft.gst_number} onChange={set("gst_number")} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact Person" required error={errors.contact_person}>
            <input className={errors.contact_person ? inputErrCls : inputCls} value={draft.contact_person} onChange={set("contact_person")} />
          </FormField>
          <FormField label="Mobile" required error={errors.mobile}>
            <input className={errors.mobile ? inputErrCls : inputCls} value={draft.mobile} onChange={set("mobile")} />
          </FormField>
        </div>
        <FormField label="Email" required error={errors.email}>
          <input className={errors.email ? inputErrCls : inputCls} value={draft.email} onChange={set("email")} />
        </FormField>
        <FormField label="Address">
          <textarea className={textareaCls} rows={2} value={draft.address_line_1} onChange={set("address_line_1")} />
        </FormField>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={handleSave} disabled={saving}><Check size={15} /> Save &amp; Select</button>
        </div>
      </div>
    </Modal>
  );
}
