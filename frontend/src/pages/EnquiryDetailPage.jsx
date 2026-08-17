import { useEffect, useState } from "react";
import { ArrowLeft, Ban, ClipboardList, Loader2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getEnquiry, patchEnquiry } from "../api/enquiries";
import Breadcrumb from "../components/Breadcrumb";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { btnDanger, btnGhost, btnPrimary, cardCls } from "../components/ui";
import ActivityTab from "../components/enquiry/ActivityTab";
import InvoiceTab from "../components/enquiry/InvoiceTab";
import OrderTab from "../components/enquiry/OrderTab";
import OverviewTab from "../components/enquiry/OverviewTab";
import QuotationTab from "../components/enquiry/QuotationTab";
import RequirementsTab from "../components/enquiry/RequirementsTab";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { formatCurrency, formatDate } from "../utils/format";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "requirements", label: "Requirements" },
  { key: "quotation", label: "Quotation" },
  { key: "order", label: "Order" },
  { key: "invoice", label: "Invoice" },
  { key: "activity", label: "Activity" },
];

export default function EnquiryDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const askConfirm = useConfirm();
  const { showToast } = useToast();

  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  async function refresh() {
    const data = await getEnquiry(id);
    setEnquiry(data);
    return data;
  }

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [id]);

  async function cancelEnquiry() {
    await patchEnquiry(id, { status: "Cancelled" });
    await refresh();
    showToast("Enquiry cancelled.", "success");
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 size={22} className="text-teal-600 animate-spin" /></div>;
  }
  if (!enquiry) {
    return <EmptyState icon={ClipboardList} title="Enquiry not found" message="This enquiry may have been removed." action={<button className={btnPrimary} onClick={() => navigate("/enquiries")}>Back to Enquiries</button>} />;
  }

  const customer = enquiry.customer_detail;

  return (
    <div>
      <Breadcrumb items={[{ label: "Enquiries", onClick: () => navigate("/enquiries") }, { label: enquiry.enquiry_number }]} />
      <button onClick={() => navigate("/enquiries")} className={btnGhost + " mb-4"}><ArrowLeft size={15} /> Back to Enquiries</button>

      <div className={`${cardCls} p-5 mb-5`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 font-mono">{enquiry.enquiry_number}</h1>
              <StatusBadge status={enquiry.status} type="enquiry" />
            </div>
            <button onClick={() => navigate(`/customers/${customer.id}`)} className="text-sm text-teal-700 font-medium hover:underline mt-1">
              {customer.company_name}
            </button>
            <p className="text-xs text-slate-400 mt-0.5">{enquiry.business_line} · Raised {formatDate(enquiry.enquiry_date)}</p>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Quotation Value</p>
              <p className="text-base font-bold text-slate-900">{enquiry.quotation.status === "Not Prepared" ? "Not Prepared" : formatCurrency(enquiry.quotation.total_value)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Order Status</p>
              <StatusBadge status={enquiry.order.status} type="order" />
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-400">Invoice Status</p>
              <StatusBadge status={enquiry.invoice.status} type="invoice" />
            </div>
            {enquiry.status !== "Cancelled" && (
              <button
                className={btnDanger}
                onClick={() => askConfirm({
                  title: "Cancel enquiry?",
                  message: `${enquiry.enquiry_number} will be marked as Cancelled. The record and its history are preserved.`,
                  danger: true,
                  confirmLabel: "Cancel Enquiry",
                  onConfirm: cancelEnquiry,
                })}
              >
                <Ban size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key ? "text-teal-700 border-teal-600" : "text-slate-500 border-transparent hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab enquiry={enquiry} customer={customer} startEdit={searchParams.get("edit") === "1"} onChanged={refresh} />}
      {tab === "requirements" && <RequirementsTab enquiry={enquiry} onChanged={refresh} />}
      {tab === "quotation" && <QuotationTab enquiry={enquiry} onChanged={refresh} />}
      {tab === "order" && <OrderTab enquiry={enquiry} onChanged={refresh} />}
      {tab === "invoice" && <InvoiceTab enquiry={enquiry} onChanged={refresh} />}
      {tab === "activity" && <ActivityTab enquiry={enquiry} />}
    </div>
  );
}
