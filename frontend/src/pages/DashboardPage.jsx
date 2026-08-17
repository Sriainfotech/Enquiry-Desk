import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle, ArrowRight, Building2, CheckCircle2, ClipboardList, Clock, Eye, FileText,
  Package, Pencil, Plus, Receipt, TrendingDown, TrendingUp, Users, Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { fetchDashboard, fetchDashboardRecentActivity, fetchDashboardRecentEnquiries } from "../api/enquiries";
import Code from "../components/Code";
import DashboardDateFilter from "../components/DashboardDateFilter";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import SectionError from "../components/SectionError";
import Skeleton from "../components/Skeleton";
import StatusBadge from "../components/StatusBadge";
import { btnGhostSm, btnPrimary, cardCls, tableHeadCls } from "../components/ui";
import { messageFrom } from "../utils/apiError";
import { formatCurrency, formatDate, formatDateTime, todayStr } from "../utils/format";

const PIPELINE_META = {
  "New Enquiry": { icon: ClipboardList, color: "bg-slate-100 text-slate-600" },
  Quotation: { icon: FileText, color: "bg-indigo-100 text-indigo-600" },
  Order: { icon: Package, color: "bg-amber-100 text-amber-600" },
  Invoice: { icon: Receipt, color: "bg-blue-100 text-blue-600" },
  Completed: { icon: CheckCircle2, color: "bg-teal-100 text-teal-600" },
};
const RECENT_ENQUIRIES_PAGE_SIZE = 10;

function TrendTag({ trend }) {
  if (!trend) return null;
  const Icon = trend.up ? TrendingUp : TrendingDown;
  const cls = trend.up ? "text-green-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${cls}`}>
      <Icon size={11} /> {trend.pct}%
    </span>
  );
}

function KpiSkeleton() {
  return (
    <div className={`${cardCls} p-4`}>
      <div className="flex items-center justify-between mb-2.5">
        <Skeleton className="w-8 h-8 rounded-md" />
        <Skeleton className="w-10 h-3" />
      </div>
      <Skeleton className="w-24 h-3 mb-2" />
      <Skeleton className="w-16 h-6" />
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const [dateFilter, setDateFilter] = useState({ preset: "this_month", dateFrom: todayStr(), dateTo: todayStr() });

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");

  const [enquiriesPage, setEnquiriesPage] = useState(1);
  const [enquiriesPageSize, setEnquiriesPageSize] = useState(RECENT_ENQUIRIES_PAGE_SIZE);
  const [enquiriesData, setEnquiriesData] = useState({ results: [], count: 0, total_pages: 1 });
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [enquiriesError, setEnquiriesError] = useState("");

  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  const dashboardParams = dateFilter.preset === "custom"
    ? { date_range: "custom", date_from: dateFilter.dateFrom, date_to: dateFilter.dateTo }
    : { date_range: dateFilter.preset };

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    setSummaryError("");
    fetchDashboard(dashboardParams)
      .then(setSummary)
      .catch((err) => setSummaryError(messageFrom(err)))
      .finally(() => setSummaryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const loadEnquiries = useCallback(() => {
    setEnquiriesLoading(true);
    setEnquiriesError("");
    fetchDashboardRecentEnquiries({ page: enquiriesPage, page_size: enquiriesPageSize })
      .then(setEnquiriesData)
      .catch((err) => setEnquiriesError(messageFrom(err)))
      .finally(() => setEnquiriesLoading(false));
  }, [enquiriesPage, enquiriesPageSize]);

  function changeEnquiriesPageSize(size) {
    setEnquiriesPageSize(size);
    setEnquiriesPage(1);
  }

  const loadActivity = useCallback(() => {
    setActivityLoading(true);
    setActivityError("");
    fetchDashboardRecentActivity(10)
      .then(setActivity)
      .catch((err) => setActivityError(messageFrom(err)))
      .finally(() => setActivityLoading(false));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadEnquiries(); }, [loadEnquiries]);
  useEffect(() => { loadActivity(); }, [loadActivity]);

  const cards = summary ? [
    { label: "Total Customers", value: summary.total_customers, icon: Users, color: "text-teal-600 bg-teal-50", trend: summary.trends.customers },
    { label: "Total Enquiries", value: summary.total_enquiries, icon: ClipboardList, color: "text-blue-600 bg-blue-50", trend: summary.trends.enquiries },
    { label: "Pending Quotations", value: summary.pending_quotations, icon: FileText, color: "text-amber-600 bg-amber-50", caption: "Awaiting a decision" },
    { label: "Total Quotation Value", value: formatCurrency(summary.quotation_value), icon: Wallet, color: "text-indigo-600 bg-indigo-50", caption: "In selected period" },
    { label: "Orders Confirmed", value: summary.orders_confirmed, icon: Package, color: "text-green-600 bg-green-50", trend: summary.trends.orders_confirmed },
    { label: "Total Order Value", value: formatCurrency(summary.order_value), icon: TrendingUp, color: "text-teal-600 bg-teal-50", caption: "Confirmed + completed" },
    { label: "Invoices Generated", value: summary.invoices_generated, icon: Receipt, color: "text-blue-600 bg-blue-50", trend: summary.trends.invoices_generated },
    { label: "Pending Invoice Value", value: formatCurrency(summary.pending_invoice_value), icon: AlertCircle, color: "text-red-600 bg-red-50", caption: "Unpaid / overdue" },
  ] : [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of customers, enquiries and revenue pipeline"
        action={
          <DashboardDateFilter
            preset={dateFilter.preset}
            dateFrom={dateFilter.dateFrom}
            dateTo={dateFilter.dateTo}
            onChange={setDateFilter}
          />
        }
      />

      {summaryError ? (
        <div className={`${cardCls} mb-6`}><SectionError message={`Unable to load dashboard metrics. ${summaryError}`} onRetry={loadSummary} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {summaryLoading
            ? Array.from({ length: 8 }).map((_, i) => <KpiSkeleton key={i} />)
            : cards.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} className={`${cardCls} p-4`}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${c.color}`}>
                        <Icon size={15} />
                      </div>
                      {c.trend ? <TrendTag trend={c.trend} /> : c.caption ? <span className="text-[11px] text-slate-400">{c.caption}</span> : null}
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide leading-none">{c.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-2 leading-none tracking-tight">{c.value}</p>
                    {c.trend && <p className="text-[10px] text-slate-400 mt-1.5">vs previous period</p>}
                  </div>
                );
              })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className={`${cardCls} p-5 lg:col-span-2`}>
          <h3 className="text-[13px] font-semibold text-slate-800 mb-5 uppercase tracking-wide">Enquiry Pipeline</h3>
          {summaryLoading ? (
            <div className="flex items-center gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2 min-w-[92px]">
                  <Skeleton className="w-11 h-11 rounded-full" />
                  <Skeleton className="w-6 h-4" />
                  <Skeleton className="w-14 h-2.5" />
                </div>
              ))}
            </div>
          ) : summaryError ? (
            <p className="text-sm text-slate-400">Unable to load.</p>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {summary.pipeline.map((s, i) => {
                const meta = PIPELINE_META[s.label] || PIPELINE_META["New Enquiry"];
                const Icon = meta.icon;
                const base = summary.pipeline[0].count;
                const pct = base > 0 ? Math.round((s.count / base) * 100) : 0;
                return (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center gap-2 min-w-[92px]">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center ${meta.color}`}>
                        <Icon size={18} />
                      </div>
                      <p className="text-lg font-bold text-slate-900 leading-none">{s.count}</p>
                      <p className="text-[11px] text-slate-500 text-center leading-tight">{s.label}</p>
                      {i > 0 && <p className="text-[10px] text-slate-400 leading-none">{pct}%</p>}
                    </div>
                    {i < summary.pipeline.length - 1 && <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[13px] font-semibold text-slate-800 uppercase tracking-wide">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-xs text-teal-600 font-medium hover:underline">View all</button>
          </div>
          {summaryLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-full h-9" />)}
            </div>
          ) : summaryError ? (
            <p className="text-xs text-slate-400">Unable to load.</p>
          ) : summary.recent_customers.length === 0 ? (
            <EmptyState icon={Users} title="No customers yet" message="Add your first customer to get started." action={<button className={btnPrimary} onClick={() => navigate("/customers/new")}><Plus size={16} /> Add Customer</button>} />
          ) : (
            <div className="space-y-1">
              {summary.recent_customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="w-full flex items-center gap-3 text-left hover:bg-slate-50 rounded-md p-1.5 -m-0"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 truncate">{c.company_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{c.contact_person} · {formatDate(c.created_at)}</p>
                  </div>
                  <StatusBadge status={c.is_active ? "Active" : "Inactive"} type="active" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`${cardCls} mb-6`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[13px] font-semibold text-slate-800 uppercase tracking-wide">Recent Enquiries</h3>
          <button onClick={() => navigate("/enquiries")} className="text-xs text-teal-600 font-medium hover:underline">View all</button>
        </div>
        {enquiriesError ? (
          <SectionError message={`Unable to load recent enquiries. ${enquiriesError}`} onRetry={loadEnquiries} />
        ) : enquiriesLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="w-full h-10" />)}
          </div>
        ) : enquiriesData.results.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No enquiries yet" message="Create your first enquiry to see it here." action={<button className={btnPrimary} onClick={() => navigate("/enquiries/new")}><Plus size={16} /> Create Enquiry</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeadCls}>
                    <th className="px-5 py-2.5 font-semibold">Enquiry No.</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Business Line</th>
                    <th className="px-3 py-2.5 font-semibold">Requirement</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Quotation Value</th>
                    <th className="px-3 py-2.5 font-semibold">Quotation</th>
                    <th className="px-3 py-2.5 font-semibold">Order</th>
                    <th className="px-3 py-2.5 font-semibold">Invoice</th>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiriesData.results.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3"><Code>{e.enquiry_number}</Code></td>
                      <td className="px-3 py-3 text-slate-700">{e.customer_detail?.company_name || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{e.business_line}</td>
                      <td className="px-3 py-3 text-slate-500 truncate max-w-[160px]">{e.first_requirement || "—"}</td>
                      <td className="px-3 py-3 text-right font-medium text-slate-800">{formatCurrency(e.quotation?.total_value || e.quotation?.value)}</td>
                      <td className="px-3 py-3"><StatusBadge status={e.quotation?.status} type="quotation" /></td>
                      <td className="px-3 py-3"><StatusBadge status={e.order?.status} type="order" /></td>
                      <td className="px-3 py-3"><StatusBadge status={e.invoice?.status} type="invoice" /></td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.enquiry_date)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button title="View" onClick={() => navigate(`/enquiries/${e.id}`)} className={btnGhostSm}><Eye size={13} /></button>
                          <button title="Edit" onClick={() => navigate(`/enquiries/${e.id}?edit=1`)} className={btnGhostSm}><Pencil size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={enquiriesPage} setPage={setEnquiriesPage}
              totalPages={enquiriesData.total_pages} totalItems={enquiriesData.count}
              pageSize={enquiriesPageSize} onPageSizeChange={changeEnquiriesPageSize}
              pageSizeOptions={[10, 20, 50]}
            />
          </>
        )}
      </div>

      <div className={cardCls}>
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-[13px] font-semibold text-slate-800 uppercase tracking-wide">Recent Activity</h3>
        </div>
        {activityError ? (
          <SectionError message={`Unable to load recent activity. ${activityError}`} onRetry={loadActivity} />
        ) : activityLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="w-full h-8" />)}
          </div>
        ) : activity.length === 0 ? (
          <EmptyState icon={Clock} title="No recent activity" message="Actions taken on enquiries will show up here." />
        ) : (
          <div className="divide-y divide-slate-50">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock size={13} className="text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">
                    <button onClick={() => navigate(`/enquiries/${a.enquiry}`)} className="font-medium font-mono text-teal-700 hover:underline">{a.enquiry_number}</button>
                    {" "}{a.action}{a.customer_name && <span className="text-slate-500"> · {a.customer_name}</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formatDateTime(a.created_at)}{a.user_name && ` · ${a.user_name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
