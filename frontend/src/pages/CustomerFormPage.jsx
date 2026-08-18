import { useEffect, useState } from "react";
import { ArrowLeft, Briefcase, Building2, Check, Loader2, MapPin, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createCustomer, getCustomer, updateCustomer } from "../api/customers";
import Breadcrumb from "../components/Breadcrumb";
import FormField from "../components/FormField";
import PageHeader from "../components/PageHeader";
import SearchableSelect from "../components/SearchableSelect";
import { btnGhost, btnPrimary, btnSecondary, cardCls, focusRing, inputCls, inputErrCls, labelCls, sectionTitleCls, textareaCls } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../utils/apiError";
import { COMPANY_TYPES, CUSTOMER_TYPES, INDIAN_STATES, INDUSTRIES } from "../constants";
import * as v from "../utils/validators";

const FORM_MAX_WIDTH = "max-w-[1400px]";
// Base grid is 12 columns: col-span-12 (mobile, 1-up) -> sm:col-span-6 (tablet, 2-up)
// -> lg:col-span-N (desktop, field width matched to the data it holds).
// NOTE: these must stay full literal strings — Tailwind's JIT scanner greps source
// text for class names, so a template-built "lg:col-span-" + n would never be found.
const SPAN = {
  3: "col-span-12 sm:col-span-6 lg:col-span-3",
  4: "col-span-12 sm:col-span-6 lg:col-span-4",
  5: "col-span-12 sm:col-span-6 lg:col-span-5",
  6: "col-span-12 sm:col-span-6 lg:col-span-6",
  7: "col-span-12 sm:col-span-6 lg:col-span-7",
};
const g = (lg) => SPAN[lg];

function emptyDraft() {
  return {
    company_name: "", gst_number: "", pan_number: "", company_type: "", website: "",
    contact_person: "", designation: "", mobile: "", alternate_mobile: "", email: "", alternate_email: "",
    address_line_1: "", address_line_2: "", city: "", state: "", country: "India", pincode: "",
    customer_type: "", industry: "", notes: "", is_active: true,
  };
}

const VALIDATORS = {
  company_name: v.companyName,
  gst_number: v.gstNumber,
  pan_number: v.panNumber,
  website: v.website,
  contact_person: v.contactPerson,
  designation: v.designation,
  mobile: (val) => v.mobile(val),
  alternate_mobile: (val) => v.mobile(val, { requiredField: false, label: "Alternate mobile" }),
  email: (val) => v.email(val),
  alternate_email: (val) => v.email(val, { requiredField: false, label: "Alternate email" }),
  address_line_1: v.addressLine1,
  address_line_2: v.addressLine2,
  city: v.city,
  pincode: v.pincode,
  notes: (val) => v.maxLen(val, 500, "Notes"),
};

const digitsOnly = (max) => (raw) => raw.replace(/\D/g, "").slice(0, max);

export default function CustomerFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [draft, setDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(mode === "edit");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (mode === "edit" && id) {
      getCustomer(id).then((c) => {
        setDraft({ ...emptyDraft(), ...c });
        setCompanyName(c.company_name);
      }).finally(() => setLoading(false));
    }
  }, [mode, id]);

  const set = (field, transform) => (e) => {
    const raw = e.target.value;
    setDraft((d) => ({ ...d, [field]: transform ? transform(raw) : raw }));
  };
  const setUpper = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value.toUpperCase() }));

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
  const validateOnBlur = (field) => () => {
    runValidator(field, draft[field]);
    // These two only make sense compared against another field, so re-check them
    // whenever either side of the pair is touched.
    if (field === "mobile" || field === "alternate_mobile" || field === "email" || field === "alternate_email") {
      const crossErrs = v.customerCrossFieldErrors(draft);
      setErrors((prev) => ({ ...prev, ...crossErrs }));
    }
  };

  async function handleSave() {
    const clientErrs = { ...v.validateAll(draft, VALIDATORS), ...v.customerCrossFieldErrors(draft) };
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      showToast("Please fix the highlighted fields.", "error");
      return;
    }
    setSaving(true);
    try {
      const saved = mode === "edit" ? await updateCustomer(id, draft) : await createCustomer(draft);
      showToast(mode === "edit" ? "Customer updated." : "Customer added.", "success");
      navigate(`/customers/${saved.id}`);
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

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={22} className="text-teal-600 animate-spin" /></div>;
  }

  const backTarget = mode === "edit" ? `/customers/${id}` : "/customers";
  const cls = (field) => (errors[field] ? inputErrCls : inputCls);

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Customers", onClick: () => navigate("/customers") },
          { label: mode === "edit" ? (companyName || "Edit Customer") : "Add Customer" },
        ]}
      />
      <button onClick={() => navigate(backTarget)} className={btnGhost + " mb-4"}>
        <ArrowLeft size={15} /> Back
      </button>
      <PageHeader title={mode === "edit" ? "Edit Customer" : "Add Customer"} subtitle="Fields marked with * are required" />

      <div className={`space-y-4 ${FORM_MAX_WIDTH} mx-auto`}>
        <div className={`${cardCls} p-5`}>
          <h3 className={sectionTitleCls}><Building2 size={15} /> Company Information</h3>
          <div className="grid grid-cols-12 gap-4">
            <FormField className={g(6)} label="Company Name" required error={errors.company_name} counter={{ value: draft.company_name.length, max: 100 }}>
              <input className={cls("company_name")} value={draft.company_name} onChange={set("company_name")} onBlur={validateOnBlur("company_name")} placeholder="Enter company name" maxLength={100} />
            </FormField>
            <FormField className={g(3)} label="GST Number" error={errors.gst_number} hint="15 characters">
              <input className={cls("gst_number")} value={draft.gst_number} onChange={setUpper("gst_number")} onBlur={validateOnBlur("gst_number")} placeholder="36AAACA1234B1Z9" maxLength={15} />
            </FormField>
            <FormField className={g(3)} label="PAN Number" error={errors.pan_number} hint="10 characters">
              <input className={cls("pan_number")} value={draft.pan_number} onChange={setUpper("pan_number")} onBlur={validateOnBlur("pan_number")} placeholder="AAACA1234B" maxLength={10} />
            </FormField>
            <FormField className={g(5)} label="Company Type">
              <SearchableSelect value={draft.company_type} onChange={(val) => setDraft((d) => ({ ...d, company_type: val }))} placeholder="Select type" options={COMPANY_TYPES} />
            </FormField>
            <FormField className={g(7)} label="Website" error={errors.website}>
              <input className={cls("website")} value={draft.website} onChange={set("website")} onBlur={validateOnBlur("website")} placeholder="www.example.com" maxLength={255} />
            </FormField>
          </div>
        </div>

        <div className={`${cardCls} p-5`}>
          <h3 className={sectionTitleCls}><User size={15} /> Contact Information</h3>
          <div className="grid grid-cols-12 gap-4">
            <FormField className={g(4)} label="Contact Person" required error={errors.contact_person}>
              <input className={cls("contact_person")} value={draft.contact_person} onChange={set("contact_person")} onBlur={validateOnBlur("contact_person")} maxLength={50} />
            </FormField>
            <FormField className={g(4)} label="Designation" error={errors.designation}>
              <input className={cls("designation")} value={draft.designation} onChange={set("designation")} onBlur={validateOnBlur("designation")} maxLength={50} />
            </FormField>
            <FormField className={g(4)} label="Mobile Number" required error={errors.mobile}>
              <input className={cls("mobile")} value={draft.mobile} onChange={set("mobile", digitsOnly(10))} onBlur={validateOnBlur("mobile")} placeholder="9876543210" inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField className={g(5)} label="Email" required error={errors.email}>
              <input className={cls("email")} value={draft.email} onChange={set("email")} onBlur={validateOnBlur("email")} placeholder="name@company.com" maxLength={254} />
            </FormField>
            <FormField className={g(3)} label="Alternate Mobile" error={errors.alternate_mobile}>
              <input className={cls("alternate_mobile")} value={draft.alternate_mobile} onChange={set("alternate_mobile", digitsOnly(10))} onBlur={validateOnBlur("alternate_mobile")} inputMode="numeric" maxLength={10} />
            </FormField>
            <FormField className={g(4)} label="Alternate Email" error={errors.alternate_email}>
              <input className={cls("alternate_email")} value={draft.alternate_email} onChange={set("alternate_email")} onBlur={validateOnBlur("alternate_email")} maxLength={254} />
            </FormField>
          </div>
        </div>

        <div className={`${cardCls} p-5`}>
          <h3 className={sectionTitleCls}><MapPin size={15} /> Address</h3>
          <div className="grid grid-cols-12 gap-4">
            <FormField className={g(6)} label="Address Line 1" required error={errors.address_line_1} counter={{ value: draft.address_line_1.length, max: 150 }}>
              <input className={cls("address_line_1")} value={draft.address_line_1} onChange={set("address_line_1")} onBlur={validateOnBlur("address_line_1")} placeholder="Enter address line 1" maxLength={150} />
            </FormField>
            <FormField className={g(6)} label="Address Line 2" error={errors.address_line_2}>
              <input className={cls("address_line_2")} value={draft.address_line_2} onChange={set("address_line_2")} onBlur={validateOnBlur("address_line_2")} placeholder="Enter address line 2" maxLength={150} />
            </FormField>
            <FormField className={g(3)} label="City" required error={errors.city}>
              <input className={cls("city")} value={draft.city} onChange={set("city")} onBlur={validateOnBlur("city")} placeholder="Enter city" maxLength={50} />
            </FormField>
            <FormField className={g(3)} label="State" required>
              <SearchableSelect value={draft.state} onChange={(val) => setDraft((d) => ({ ...d, state: val }))} placeholder="Select state" options={INDIAN_STATES} />
            </FormField>
            <FormField className={g(3)} label="Country" required>
              <SearchableSelect value={draft.country} onChange={(val) => setDraft((d) => ({ ...d, country: val }))} placeholder="Select country" options={["India"]} clearable={false} searchable={false} />
            </FormField>
            <FormField className={g(3)} label="Pincode" required error={errors.pincode}>
              <input className={cls("pincode")} value={draft.pincode} onChange={set("pincode", digitsOnly(6))} onBlur={validateOnBlur("pincode")} inputMode="numeric" maxLength={6} />
            </FormField>
          </div>
        </div>

        <div className={`${cardCls} p-5`}>
          <h3 className={sectionTitleCls}><Briefcase size={15} /> Additional Information</h3>
          <div className="grid grid-cols-12 gap-4">
            <FormField className={g(4)} label="Customer Type">
              <SearchableSelect value={draft.customer_type} onChange={(val) => setDraft((d) => ({ ...d, customer_type: val }))} placeholder="Select customer type" options={CUSTOMER_TYPES} />
            </FormField>
            <FormField className={g(4)} label="Industry">
              <SearchableSelect value={draft.industry} onChange={(val) => setDraft((d) => ({ ...d, industry: val }))} placeholder="Select industry" options={INDUSTRIES} />
            </FormField>
            <div className={g(4)}>
              <label className={labelCls}>Status</label>
              <div className="flex items-center gap-2 h-[38px]">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, is_active: !d.is_active }))}
                  className={`relative w-[38px] h-[22px] rounded-full transition-colors flex-shrink-0 ${focusRing} ${draft.is_active ? "bg-teal-600" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.is_active ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-slate-700">{draft.is_active ? "Active" : "Inactive"}</span>
              </div>
            </div>
            <FormField className="col-span-12" label="Notes" error={errors.notes} counter={{ value: draft.notes.length, max: 500 }}>
              <textarea className={textareaCls} rows={2} value={draft.notes} onChange={set("notes")} onBlur={validateOnBlur("notes")} placeholder="Any internal notes about this customer" maxLength={500} />
            </FormField>
          </div>
        </div>
      </div>

      <div className={`${FORM_MAX_WIDTH} mx-auto mt-5 pt-4 border-t border-slate-200 flex justify-end gap-2`}>
        <button className={btnSecondary} onClick={() => navigate(backTarget)}>Cancel</button>
        <button className={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {mode === "edit" ? "Save Changes" : "Save Customer"}
        </button>
      </div>
    </div>
  );
}
