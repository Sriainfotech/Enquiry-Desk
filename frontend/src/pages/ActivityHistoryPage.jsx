import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Clock, Filter, Loader2, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchActivityHistory } from "../api/enquiries";
import AsyncCustomerSelect from "../components/AsyncCustomerSelect";
import Breadcrumb from "../components/Breadcrumb";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import SectionError from "../components/SectionError";
import Skeleton from "../components/Skeleton";
import { btnGhost, cardCls, inputCls, tableHeadCls } from "../components/ui";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { messageFrom } from "../utils/apiError";
import { activityMetaFor, ACTIVITY_TYPE_OPTIONS } from "../utils/activityMeta";
import { formatDateTime } from "../utils/format";
import { PAGE_SIZE } from "../constants";

const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest First" },
  { value: "created_at", label: "Oldest First" },
];
const FILTER_KEYS = ["activity_type", "date_from", "date_to"];
const FILTER_LABELS = { activity_type: "Type", date_from: "From", date_to: "To" };

function paramsToFilters(sp) {
  const f = {};
  FILTER_KEYS.forEach((k) => { f[k] = sp.get(k) || ""; });
  return f;
}

export default function ActivityHistoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [customerId, setCustomerId] = useState(searchParams.get("customer") ? Number(searchParams.get("customer")) : null);
  const [customerLabel, setCustomerLabel] = useState("");
  const [ordering, setOrdering] = useState(searchParams.get("ordering") || "-created_at");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("page_size")) || PAGE_SIZE);

  const [data, setData] = useState({ results: [], count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);

  const skipNextReset = useRef(true);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, filters, customerId, ordering, pageSize]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    FILTER_KEYS.forEach((k) => { if (filters[k]) next.set(k, filters[k]); });
    if (customerId) next.set("customer", String(customerId));
    if (ordering !== "-created_at") next.set("ordering", ordering);
    if (page !== 1) next.set("page", String(page));
    if (pageSize !== PAGE_SIZE) next.set("page_size", String(pageSize));
    setSearchParams(next, { replace: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, customerId, ordering, page, pageSize]);

  function load() {
    setLoading(true);
    setError("");
    fetchActivityHistory({
      search: debouncedSearch || undefined,
      customer: customerId || undefined,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      ordering,
      page,
      page_size: pageSize,
    })
      .then(setData)
      .catch((err) => setError(messageFrom(err)))
      .finally(() => { setLoading(false); setInitialLoad(false); });
  }

  useEffect(() => { load(); }, [debouncedSearch, filters, customerId, ordering, page, pageSize]);

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clearAll() {
    setSearch("");
    setFilters({ activity_type: "", date_from: "", date_to: "" });
    setCustomerId(null);
    setCustomerLabel("");
    setOrdering("-created_at");
  }

  const activeChips = useMemo(() => {
    const chips = FILTER_KEYS.filter((k) => filters[k]).map((k) => ({ key: k, label: `${FILTER_LABELS[k]}: ${filters[k]}`, clear: () => setFilter(k, "") }));
    if (customerId) chips.push({ key: "customer", label: `Customer: ${customerLabel || customerId}`, clear: () => { setCustomerId(null); setCustomerLabel(""); } });
    return chips;
  }, [filters, customerId, customerLabel]);
  const activeFilterCount = activeChips.length;

  return (
    <div>
      <Breadcrumb items={[{ label: "Enquiries", onClick: () => navigate("/enquiries") }, { label: "Activity History" }]} />
      <button onClick={() => navigate("/")} className={btnGhost + " mb-4"}><ArrowLeft size={15} /> Back to Dashboard</button>
      <PageHeader title="Activity History" subtitle="Complete audit trail across every enquiry" />

      <div className={`${cardCls} p-4 mb-4`}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pl-9"} placeholder="Search by enquiry, customer, action…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-[220px]">
            <AsyncCustomerSelect value={customerId} valueLabel={customerLabel} onChange={(id, label) => { setCustomerId(id); setCustomerLabel(label || ""); }} />
          </div>
          <div className="w-[170px]">
            <SearchableSelect value={filters.activity_type} onChange={(v) => setFilter("activity_type", v)} placeholder="Activity Type" searchable={false} options={ACTIVITY_TYPE_OPTIONS} />
          </div>
          <div className="w-[180px]">
            <SearchableSelect value={ordering} onChange={setOrdering} clearable={false} searchable={false} placeholder="Sort" options={SORT_OPTIONS} />
          </div>
          {(activeFilterCount > 0 || search) && (
            <button onClick={clearAll} className="text-xs text-teal-600 font-medium hover:underline ml-auto">
              Clear filters ({activeFilterCount + (search ? 1 : 0)})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 flex-shrink-0">Date Range</span>
          <input type="date" className={inputCls + " w-[160px]"} value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} title="From date" />
          <span className="text-xs text-slate-400">to</span>
          <input type="date" className={inputCls + " w-[160px]"} value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} title="To date" />
        </div>

        {activeChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
            {activeChips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                {chip.label}
                <button onClick={chip.clear} className="p-0.5 rounded-full hover:bg-slate-200 hover:text-slate-800">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={cardCls}>
        {error ? (
          <SectionError message={`Unable to load activity history. ${error}`} onRetry={load} />
        ) : initialLoad ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="w-full h-9" />)}
          </div>
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity found"
            message={search || activeFilterCount ? "No results match your current filters." : "Actions taken on enquiries will show up here."}
          />
        ) : (
          <>
            <div className="overflow-x-auto relative">
              {loading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-start justify-center pt-10">
                  <Loader2 size={18} className="text-teal-600 animate-spin" />
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeadCls}>
                    <th className="px-5 py-2.5 font-semibold">Action</th>
                    <th className="px-3 py-2.5 font-semibold">Enquiry</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">By</th>
                    <th className="px-3 py-2.5 font-semibold">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((a) => {
                    const meta = activityMetaFor(a.action);
                    const Icon = meta.icon;
                    return (
                      <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                              <Icon size={12} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-slate-800">{a.action}</span>
                              {a.description && <p className="text-xs text-slate-400 truncate">{a.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => navigate(`/enquiries/${a.enquiry}`)} className="font-mono text-xs text-teal-700 hover:underline">{a.enquiry_number}</button>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {a.customer_id ? (
                            <button onClick={() => navigate(`/customers/${a.customer_id}`)} className="text-slate-600 hover:text-teal-700 hover:underline text-left">{a.customer_name}</button>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 text-slate-500">{a.created_by_name || "—"}</td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page} setPage={setPage} totalPages={data.total_pages} totalItems={data.count}
              pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </div>
    </div>
  );
}
