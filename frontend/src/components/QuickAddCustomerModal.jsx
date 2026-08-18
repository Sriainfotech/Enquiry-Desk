import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { createCustomer } from "../api/customers";
import { INDIAN_STATES } from "../constants";
import { fieldErrorsFrom, messageFrom } from "../utils/apiError";
import * as v from "../utils/validators";
import FormField from "./FormField";
import Modal from "./Modal";
import SearchableSelect from "./SearchableSelect";
import { btnPrimary, btnSecondary, inputCls, inputErrCls } from "./ui";

const digitsOnly = (max) => (raw) => raw.replace(/\D/g, "").slice(0, max);

const VALIDATORS = {
  company_name: v.companyName,
  gst_number: v.gstNumber,
  contact_person: v.contactPerson,
  mobile: (val) => v.mobile(val),
  email: (val) => v.email(val),
  address_line_1: v.addressLine1,
  city: v.city,
  pincode: v.pincode,
};

export default function QuickAddCustomerModal({ onClose, onCreated, showToast, prefillName }) {
  const [draft, setDraft] = useState({
    company_name: prefillName || "", gst_number: "", contact_person: "", mobile: "", email: "",
    address_line_1: "", city: "", state: "", pincode: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (field, transform) => (e) => {
    const raw = e.target.value;
    setDraft((d) => ({ ...d, [field]: transform ? transform(raw) : raw }));
  };
  const setUpper = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value.toUpperCase() }));
  const cls = (field) => (errors[field] ? inputErrCls : inputCls);

  function runValidator(field, value) {
    const rule = VALIDATORS[field];
    if (!rule) return;
    const message = rule(value);
    setErrors((prev) => {
      if (!message) {
        if (!(field in prev)) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: message };
    });
  }
  const validateOnBlur = (field) => () => runValidator(field, draft[field]);

  async function handleSave() {
    const clientErrs = v.validateAll(draft, VALIDATORS);
    if (!draft.state) clientErrs.state = "State is required.";
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      showToast("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await createCustomer({ ...draft, country: "India" });
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
    <Modal title="Add New Customer" description="This customer will be added to your master list and selected for this enquiry." onClose={onClose} width="max-w-xl">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Company Name" required error={errors.company_name} counter={{ value: draft.company_name.length, max: 100 }}>
            <input className={cls("company_name")} value={draft.company_name} onChange={set("company_name")} onBlur={validateOnBlur("company_name")} placeholder="Enter company name" autoFocus maxLength={100} />
          </FormField>
          <FormField label="GST Number" error={errors.gst_number} hint="15 characters — leave blank if not available">
            <input className={cls("gst_number")} value={draft.gst_number} onChange={setUpper("gst_number")} onBlur={validateOnBlur("gst_number")} maxLength={15} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Contact Person" required error={errors.contact_person}>
            <input className={cls("contact_person")} value={draft.contact_person} onChange={set("contact_person")} onBlur={validateOnBlur("contact_person")} maxLength={50} />
          </FormField>
          <FormField label="Mobile" required error={errors.mobile} hint="10 digits">
            <input className={cls("mobile")} value={draft.mobile} onChange={set("mobile", digitsOnly(10))} onBlur={validateOnBlur("mobile")} placeholder="9876543210" inputMode="numeric" maxLength={10} />
          </FormField>
        </div>
        <FormField label="Email" required error={errors.email}>
          <input className={cls("email")} value={draft.email} onChange={set("email")} onBlur={validateOnBlur("email")} placeholder="name@company.com" maxLength={254} />
        </FormField>
        <FormField label="Address Line 1" required error={errors.address_line_1} counter={{ value: draft.address_line_1.length, max: 150 }}>
          <input className={cls("address_line_1")} value={draft.address_line_1} onChange={set("address_line_1")} onBlur={validateOnBlur("address_line_1")} placeholder="Enter address" maxLength={150} />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="City" required error={errors.city}>
            <input className={cls("city")} value={draft.city} onChange={set("city")} onBlur={validateOnBlur("city")} maxLength={50} />
          </FormField>
          <FormField label="State" required error={errors.state}>
            <SearchableSelect value={draft.state} onChange={(val) => { setDraft((d) => ({ ...d, state: val })); setErrors((prev) => { const n = { ...prev }; delete n.state; return n; }); }} placeholder="Select state" options={INDIAN_STATES} />
          </FormField>
          <FormField label="Pincode" required error={errors.pincode} hint="6 digits">
            <input className={cls("pincode")} value={draft.pincode} onChange={set("pincode", digitsOnly(6))} onBlur={validateOnBlur("pincode")} inputMode="numeric" maxLength={6} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save &amp; Select
          </button>
        </div>
      </div>
    </Modal>
  );
}
