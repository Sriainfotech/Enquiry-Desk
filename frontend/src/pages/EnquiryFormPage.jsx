import { useState } from "react";
import { AlertCircle, ArrowLeft, Building2, Check, ClipboardList, Loader2, Mail, Package, Phone, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createEnquiry } from "../api/enquiries";
import Breadcrumb from "../components/Breadcrumb";
import CustomerCombobox from "../components/CustomerCombobox";
import FormField from "../components/FormField";
import PageHeader from "../components/PageHeader";
import QuickAddCustomerModal from "../components/QuickAddCustomerModal";
import RequirementsEditor, { newRequirementRow } from "../components/RequirementsEditor";
import SearchableSelect from "../components/SearchableSelect";
import { btnGhost, btnGhostSm, btnPrimary, btnSecondary, cardCls, inputCls, sectionTitleCls, textareaCls } from "../components/ui";
import { useToast } from "../hooks/useToast";
import { fieldErrorsFrom, messageFrom } from "../utils/apiError";
import { todayStr } from "../utils/format";
import * as v from "../utils/validators";
import { BUSINESS_LINES, ENQUIRY_SOURCES, PRIORITIES, SALES_PERSONS } from "../constants";

export default function EnquiryFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addCustomerPrefill, setAddCustomerPrefill] = useState("");

  const [businessLine, setBusinessLine] = useState("");
  const [enquirySource, setEnquirySource] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [salesPerson, setSalesPerson] = useState("");
  const [enquiryDate, setEnquiryDate] = useState(todayStr());
  const [expectedClosingDate, setExpectedClosingDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [requirements, setRequirements] = useState([newRequirementRow()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!customer) errs.customer = "Select a customer before saving the enquiry.";
    if (!businessLine) errs.businessLine = "Business line is required.";
    const salesPersonErr = v.maxLen(salesPerson, 50, "Sales person");
    if (salesPersonErr) errs.salesPerson = salesPersonErr;
    const remarksErr = v.maxLen(remarks, 500, "Remarks");
    if (remarksErr) errs.remarks = remarksErr;
    const dateErr = v.dateNotBefore(expectedClosingDate, enquiryDate, "Expected Closing Date", "Enquiry Date");
    if (dateErr) errs.expectedClosingDate = dateErr;
    if (requirements.length === 0) errs.requirements = "Add at least one requirement.";
    const rowErrs = {};
    requirements.forEach((r) => {
      const e = {};
      if (v.requirementItem(r.item)) e.item = true;
      if (v.quantity(r.quantity)) e.quantity = true;
      if (v.unitPrice(r.unit_price)) e.unit_price = true;
      if (Object.keys(e).length) rowErrs[r.id ?? r.localId] = e;
    });
    setErrors({ ...errs, rowErrs });
    return Object.keys(errs).length === 0 && Object.keys(rowErrs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      showToast("Please resolve the highlighted issues before saving.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const enquiry = await createEnquiry({
        customer: customer.id,
        business_line: businessLine,
        enquiry_source: enquirySource,
        priority,
        sales_person: salesPerson,
        enquiry_date: enquiryDate,
        expected_closing_date: expectedClosingDate || null,
        remarks,
        requirements: requirements.map((r) => ({
          item: r.item, description: r.description, quantity: Number(r.quantity), unit: r.unit, unit_price: Number(r.unit_price),
        })),
      });
      showToast(`Enquiry ${enquiry.enquiry_number} created.`, "success");
      navigate(`/enquiries/${enquiry.id}`);
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      showToast(Object.keys(fieldErrs).length ? "Please resolve the highlighted issues before saving." : messageFrom(err), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Enquiries", onClick: () => navigate("/enquiries") }, { label: "New Enquiry" }]} />
      <button onClick={() => navigate("/enquiries")} className={btnGhost + " mb-4"}><ArrowLeft size={15} /> Back to Enquiries</button>
      <PageHeader title="New Enquiry" subtitle="The enquiry number is generated automatically on save" />

      <div className="space-y-4 max-w-4xl pb-28">
        <div className={`${cardCls} p-4`}>
          <h3 className={sectionTitleCls}><Building2 size={15} /> Customer</h3>
          <FormField className="w-full sm:w-[420px]" label="Customer" required error={errors.customer}>
            <CustomerCombobox
              selectedCustomer={customer}
              onSelect={setCustomer}
              onAddNew={(text) => { setAddCustomerPrefill(text); setShowAddCustomer(true); }}
            />
          </FormField>
          {!customer && (
            <button type="button" onClick={() => { setAddCustomerPrefill(""); setShowAddCustomer(true); }} className={btnGhostSm + " mt-2"}>
              <Building2 size={13} /> Add New Customer
            </button>
          )}

          {customer && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 bg-slate-50 border border-slate-100 rounded-md px-4 py-2.5 text-sm">
              <span className="font-semibold text-slate-800">{customer.company_name}</span>
              <span className="flex items-center gap-1.5 text-slate-500"><User size={12} /> {customer.contact_person}</span>
              <span className="flex items-center gap-1.5 text-slate-500"><Phone size={12} /> {customer.mobile}</span>
              <span className="flex items-center gap-1.5 text-slate-500"><Mail size={12} /> {customer.email}</span>
            </div>
          )}
        </div>

        <div className={`${cardCls} p-4`}>
          <h3 className={sectionTitleCls}><ClipboardList size={15} /> Enquiry Information</h3>
          <div className="flex flex-wrap gap-4">
            <FormField className="w-full sm:w-[190px]" label="Enquiry Date">
              <input type="date" className={inputCls} value={enquiryDate} onChange={(e) => setEnquiryDate(e.target.value)} />
            </FormField>
            <FormField className="w-full sm:w-[260px]" label="Business Line" required error={errors.businessLine}>
              <SearchableSelect value={businessLine} onChange={setBusinessLine} placeholder="Search business line…" options={BUSINESS_LINES} error={!!errors.businessLine} />
            </FormField>
            <FormField className="w-full sm:w-[220px]" label="Enquiry Source">
              <SearchableSelect value={enquirySource} onChange={setEnquirySource} placeholder="Select source" options={ENQUIRY_SOURCES} />
            </FormField>
            <FormField className="w-full sm:w-[160px]" label="Priority">
              <SearchableSelect value={priority} onChange={setPriority} placeholder="Select priority" options={PRIORITIES} clearable={false} />
            </FormField>
            <FormField className="w-full sm:w-[230px]" label="Sales Person" error={errors.salesPerson} counter={{ value: salesPerson.length, max: 50 }}>
              <input className={inputCls} value={salesPerson} onChange={(e) => setSalesPerson(e.target.value)} placeholder="Enter sales person name" list="sales-person-suggestions" maxLength={50} />
              <datalist id="sales-person-suggestions">
                {SALES_PERSONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </FormField>
            <FormField className="w-full sm:w-[190px]" label="Expected Closing Date" error={errors.expectedClosingDate}>
              <input type="date" className={inputCls} value={expectedClosingDate} onChange={(e) => setExpectedClosingDate(e.target.value)} min={enquiryDate} />
            </FormField>
            <FormField className="w-full" label="Enquiry Remarks" error={errors.remarks} counter={{ value: remarks.length, max: 500 }}>
              <textarea className={textareaCls} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Add any additional context for this enquiry" maxLength={500} />
            </FormField>
          </div>
        </div>

        <div className={`${cardCls} p-4`}>
          <h3 className={sectionTitleCls}><Package size={15} /> Requirements</h3>
          {errors.requirements && <p className="text-xs text-red-500 mb-2 flex items-center gap-1"><AlertCircle size={12} /> {errors.requirements}</p>}
          <RequirementsEditor requirements={requirements} onChange={setRequirements} rowErrors={errors.rowErrs} />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-6 lg:-mx-8 px-6 lg:px-8 py-3 bg-white/95 backdrop-blur-sm border-t border-slate-200 flex justify-end gap-2 max-w-4xl shadow-[0_-2px_6px_rgba(15,23,42,0.04)]">
        <button className={btnSecondary} onClick={() => navigate("/enquiries")}>Cancel</button>
        <button className={btnPrimary} onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Create Enquiry
        </button>
      </div>

      {showAddCustomer && (
        <QuickAddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          showToast={showToast}
          prefillName={addCustomerPrefill}
          onCreated={(saved) => setCustomer(saved)}
        />
      )}
    </div>
  );
}
