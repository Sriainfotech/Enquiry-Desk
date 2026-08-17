import { useEffect, useState } from "react";
import { Ban, ArrowLeft, Building2, ClipboardList, Eye, Loader2, Mail, MapPin, Package, Pencil, Phone, Receipt, RotateCcw, TrendingUp, User, Users } from "lucide-react";
import { FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getCustomer, patchCustomer } from "../api/customers";
import { listEnquiries } from "../api/enquiries";
import Breadcrumb from "../components/Breadcrumb";
import Code from "../components/Code";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { btnDanger, btnGhost, btnGhostSm, btnPrimary, btnSecondary, cardCls, tableHeadCls } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { formatCurrency, formatDate } from "../utils/format";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const askConfirm = useConfirm();
  const { showToast } = useToast();

  const [customer, setCustomer] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([getCustomer(id), listEnquiries({ customer: id, page_size: 200 })])
      .then(([c, e]) => { setCustomer(c); setEnquiries(e.results); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function toggleActive() {
    const updated = await patchCustomer(customer.id, { is_active: !customer.is_active });
    setCustomer(updated);
    showToast("Customer status updated.", "success");
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={22} className="text-teal-600 animate-spin" /></div>;
  }
  if (!customer) {
    return <EmptyState icon={Users} title="Customer not found" message="This customer may have been removed." action={<button className={btnPrimary} onClick={() => navigate("/customers")}>Back to Customers</button>} />;
  }

  const totals = enquiries.reduce(
    (acc, e) => {
      if (e.quotation?.status !== "Not Prepared") acc.totalQuotationValue += Number(e.quotation?.total_value || 0);
      if (e.order?.status !== "Not Converted") acc.totalOrders += 1;
      if (["Confirmed", "Partially Confirmed", "Completed"].includes(e.order?.status)) acc.totalOrderValue += Number(e.order?.value || 0);
      if (e.invoice?.status !== "Not Generated") acc.totalInvoiceValue += Number(e.invoice?.value || 0);
      return acc;
    },
    { totalQuotationValue: 0, totalOrders: 0, totalOrderValue: 0, totalInvoiceValue: 0 }
  );

  const cards = [
    { label: "Total Enquiries", value: enquiries.length, icon: ClipboardList },
    { label: "Total Quotation Value", value: formatCurrency(totals.totalQuotationValue), icon: FileText },
    { label: "Total Orders", value: totals.totalOrders, icon: Package },
    { label: "Total Order Value", value: formatCurrency(totals.totalOrderValue), icon: TrendingUp },
    { label: "Total Invoice Value", value: formatCurrency(totals.totalInvoiceValue), icon: Receipt },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: "Customers", onClick: () => navigate("/customers") }, { label: customer.company_name }]} />
      <button onClick={() => navigate("/customers")} className={btnGhost + " mb-4"}><ArrowLeft size={15} /> Back to Customers</button>

      <div className={`${cardCls} p-5 mb-5`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className="text-teal-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-slate-900">{customer.company_name}</h1>
                <StatusBadge status={customer.is_active ? "Active" : "Inactive"} type="active" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5"><Code>{customer.customer_code}</Code>{customer.gst_number && <> · GST: <span className="font-mono">{customer.gst_number}</span></>}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                <span className="flex items-center gap-1.5"><User size={13} className="text-slate-400" /> {customer.contact_person}</span>
                <span className="flex items-center gap-1.5"><Phone size={13} className="text-slate-400" /> {customer.mobile}</span>
                <span className="flex items-center gap-1.5"><Mail size={13} className="text-slate-400" /> {customer.email}</span>
                {(customer.city || customer.address_line_1) && (
                  <span className="flex items-center gap-1.5"><MapPin size={13} className="text-slate-400" /> {[customer.address_line_1, customer.city, customer.state].filter(Boolean).join(", ")}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => navigate(`/customers/${customer.id}/edit`)}><Pencil size={14} /> Edit</button>
            <button
              className={customer.is_active ? btnDanger : btnPrimary}
              onClick={() =>
                askConfirm({
                  title: customer.is_active ? "Deactivate customer?" : "Activate customer?",
                  message: customer.is_active ? `${customer.company_name} will be marked inactive.` : `${customer.company_name} will be marked active again.`,
                  danger: customer.is_active,
                  confirmLabel: customer.is_active ? "Deactivate" : "Activate",
                  onConfirm: toggleActive,
                })
              }
            >
              {customer.is_active ? <Ban size={14} /> : <RotateCcw size={14} />} {customer.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className={`${cardCls} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                <Icon size={14} className="text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-2">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className={cardCls}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Enquiry History</h3>
        </div>
        {enquiries.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No enquiries yet" message="Enquiries raised by this customer will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={tableHeadCls}>
                  <th className="px-5 py-2.5 font-semibold">Enquiry #</th>
                  <th className="px-3 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Business Line</th>
                  <th className="px-3 py-2.5 font-semibold">Requirement</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Quotation Value</th>
                  <th className="px-3 py-2.5 font-semibold">Quotation</th>
                  <th className="px-3 py-2.5 font-semibold">Order</th>
                  <th className="px-3 py-2.5 font-semibold">Invoice</th>
                  <th className="px-3 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {enquiries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-3"><Code>{e.enquiry_number}</Code></td>
                    <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.enquiry_date)}</td>
                    <td className="px-3 py-3 text-slate-600">{e.business_line}</td>
                    <td className="px-3 py-3 text-slate-500 truncate max-w-[160px]">{e.first_requirement || "—"}</td>
                    <td className="px-3 py-3 text-right font-medium text-slate-800">{formatCurrency(e.quotation?.total_value || e.quotation?.value)}</td>
                    <td className="px-3 py-3"><StatusBadge status={e.quotation?.status} type="quotation" /></td>
                    <td className="px-3 py-3"><StatusBadge status={e.order?.status} type="order" /></td>
                    <td className="px-3 py-3"><StatusBadge status={e.invoice?.status} type="invoice" /></td>
                    <td className="px-3 py-3">
                      <button onClick={() => navigate(`/enquiries/${e.id}`)} className={btnGhostSm}><Eye size={13} /> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
