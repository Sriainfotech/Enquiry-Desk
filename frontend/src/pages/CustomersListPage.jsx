import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, ChevronDown, Eye, Filter, Loader2, Pencil, Plus, RotateCcw, Search, Users, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listCustomers, patchCustomer } from "../api/customers";
import Code from "../components/Code";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import StatusBadge from "../components/StatusBadge";
import { btnGhostSm, btnPrimary, btnSecondary, cardCls, inputCls, tableHeadCls } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import {
  COMPANY_TYPES, CUSTOMER_SORT_OPTIONS, CUSTOMER_TYPES, INDIAN_STATES, INDUSTRIES, PAGE_SIZE,
} from "../constants";

const FILTER_KEYS = ["is_active", "customer_type", "company_type", "industry", "state", "city", "created_from", "created_to"];
const FILTER_LABELS = {
  is_active: "Status", customer_type: "Customer Type", company_type: "Company Type",
  industry: "Industry", state: "State", city: "City", created_from: "Created From", created_to: "Created To",
};

function paramsToFilters(sp) {
  const f = {};
  FILTER_KEYS.forEach((k) => { f[k] = sp.get(k) || ""; });
  return f;
}

export default function CustomersListPage() {
  const navigate = useNavigate();
  const askConfirm = useConfirm();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [ordering, setOrdering] = useState(searchParams.get("ordering") || "-created_at");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("page_size")) || PAGE_SIZE);

  const [data, setData] = useState({ results: [], count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const MORE_FILTER_KEYS = ["company_type", "industry", "city", "created_from", "created_to"];
  const [showMoreFilters, setShowMoreFilters] = useState(() => MORE_FILTER_KEYS.some((k) => searchParams.get(k)));

  // Reset to page 1 whenever search/filters/sort/page-size change — but not on
  // initial mount, where `page` may have been restored from the URL.
  const skipNextReset = useRef(true);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, filters, ordering, pageSize]);

  // Keep the URL in sync so refresh / back / forward / shared links preserve list state.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set("search", debouncedSearch);
    FILTER_KEYS.forEach((k) => { if (filters[k]) next.set(k, filters[k]); });
    if (ordering !== "-created_at") next.set("ordering", ordering);
    if (page !== 1) next.set("page", String(page));
    if (pageSize !== PAGE_SIZE) next.set("page_size", String(pageSize));
    setSearchParams(next, { replace: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, ordering, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCustomers({
      search: debouncedSearch || undefined,
      is_active: filters.is_active ? filters.is_active === "Active" : undefined,
      customer_type: filters.customer_type || undefined,
      company_type: filters.company_type || undefined,
      industry: filters.industry || undefined,
      state: filters.state || undefined,
      city: filters.city || undefined,
      created_from: filters.created_from || undefined,
      created_to: filters.created_to || undefined,
      ordering,
      page,
      page_size: pageSize,
    })
      .then((res) => { if (!cancelled) setData(res); })
      .finally(() => { if (!cancelled) { setLoading(false); setInitialLoad(false); } });
    return () => { cancelled = true; };
  }, [debouncedSearch, filters, ordering, page, pageSize]);

  async function toggleActive(customer) {
    try {
      await patchCustomer(customer.id, { is_active: !customer.is_active });
      showToast("Customer status updated.", "success");
      setData((d) => ({ ...d, results: d.results.map((c) => (c.id === customer.id ? { ...c, is_active: !c.is_active } : c)) }));
    } catch {
      showToast("Could not update customer status.", "error");
    }
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clearAll() {
    setSearch("");
    setFilters({ is_active: "", customer_type: "", company_type: "", industry: "", state: "", city: "", created_from: "", created_to: "" });
    setOrdering("-created_at");
  }

  const activeChips = useMemo(
    () => FILTER_KEYS.filter((k) => filters[k]).map((k) => ({ key: k, label: `${FILTER_LABELS[k]}: ${filters[k]}` })),
    [filters]
  );
  const activeFilterCount = activeChips.length;

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Manage customer information and enquiry history"
        action={
          <button className={btnPrimary} onClick={() => navigate("/customers/new")}>
            <Plus size={16} /> Add Customer
          </button>
        }
      />

      <div className={`${cardCls} p-4 mb-4`}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px] sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pl-9"} placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full sm:w-[150px]">
            <SearchableSelect value={filters.is_active} onChange={(v) => setFilter("is_active", v)} placeholder="Status" searchable={false} options={["Active", "Inactive"]} />
          </div>
          <div className="w-full sm:w-[190px]">
            <SearchableSelect value={filters.customer_type} onChange={(v) => setFilter("customer_type", v)} placeholder="Customer Type" options={CUSTOMER_TYPES} />
          </div>
          <div className="w-full sm:w-[220px]">
            <SearchableSelect value={filters.state} onChange={(v) => setFilter("state", v)} placeholder="State" options={INDIAN_STATES} />
          </div>
          <button
            onClick={() => setShowMoreFilters((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium hover:text-teal-700 px-2 h-[38px]"
          >
            <Filter size={13} /> More Filters <ChevronDown size={13} className={`transition-transform ${showMoreFilters ? "rotate-180" : ""}`} />
          </button>
          {(activeFilterCount > 0 || search) && (
            <button onClick={clearAll} className="text-xs text-teal-600 font-medium hover:underline ml-auto">
              Clear filters ({activeFilterCount + (search ? 1 : 0)})
            </button>
          )}
        </div>

        {showMoreFilters && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex flex-wrap gap-2">
              <div className="w-full sm:w-[220px]">
                <SearchableSelect value={filters.company_type} onChange={(v) => setFilter("company_type", v)} placeholder="Company Type" options={COMPANY_TYPES} />
              </div>
              <div className="w-full sm:w-[220px]">
                <SearchableSelect value={filters.industry} onChange={(v) => setFilter("industry", v)} placeholder="Industry" options={INDUSTRIES} />
              </div>
              <input className={inputCls + " w-full sm:w-[190px]"} placeholder="Filter by city" value={filters.city} onChange={(e) => setFilter("city", e.target.value)} />
              <div className="w-full sm:w-[220px]">
                <SearchableSelect value={ordering} onChange={setOrdering} clearable={false} searchable={false} placeholder="Sort" options={CUSTOMER_SORT_OPTIONS} />
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 flex-shrink-0">Created</span>
              <input type="date" className={inputCls + " w-[calc(50%-38px)] sm:w-[160px]"} value={filters.created_from} onChange={(e) => setFilter("created_from", e.target.value)} title="Created from" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" className={inputCls + " w-[calc(50%-38px)] sm:w-[160px]"} value={filters.created_to} onChange={(e) => setFilter("created_to", e.target.value)} title="Created to" />
            </div>
          </div>
        )}

        {activeChips.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
            {activeChips.map((chip) => (
              <span key={chip.key} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                {chip.label}
                <button onClick={() => setFilter(chip.key, "")} className="p-0.5 rounded-full hover:bg-slate-200 hover:text-slate-800">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className={cardCls}>
        {initialLoad ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="text-teal-600 animate-spin" /></div>
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            message={search || activeFilterCount ? "No results match your current filters." : "Add your first customer to get started."}
            action={
              search || activeFilterCount ? (
                <button className={btnPrimary} onClick={clearAll}>Clear Filters</button>
              ) : (
                <button className={btnPrimary} onClick={() => navigate("/customers/new")}><Plus size={16} /> Add Customer</button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop / tablet: data table. */}
            <div className="hidden md:block overflow-x-auto relative">
              {loading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-start justify-center pt-10">
                  <Loader2 size={18} className="text-teal-600 animate-spin" />
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className={tableHeadCls}>
                    <th className="px-5 py-2.5 font-semibold">Customer ID</th>
                    <th className="px-3 py-2.5 font-semibold">Company Name</th>
                    <th className="px-3 py-2.5 font-semibold">GST Number</th>
                    <th className="px-3 py-2.5 font-semibold">Contact Person</th>
                    <th className="px-3 py-2.5 font-semibold">Mobile</th>
                    <th className="px-3 py-2.5 font-semibold">Email</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Enquiries</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                    <th className="px-3 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((c) => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3"><Code>{c.customer_code}</Code></td>
                      <td className="px-3 py-3">
                        <button onClick={() => navigate(`/customers/${c.id}`)} className="font-medium text-slate-800 hover:text-teal-700 text-left">
                          {c.company_name}
                        </button>
                        {c.city && <p className="text-[11px] text-slate-400">{c.city}{c.state ? `, ${c.state}` : ""}</p>}
                      </td>
                      <td className="px-3 py-3 text-slate-500 font-mono text-xs">{c.gst_number || "—"}</td>
                      <td className="px-3 py-3 text-slate-600">{c.contact_person}</td>
                      <td className="px-3 py-3 text-slate-600">{c.mobile}</td>
                      <td className="px-3 py-3 text-slate-600 truncate max-w-[170px]">{c.email}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{c.total_enquiries}</td>
                      <td className="px-3 py-3"><StatusBadge status={c.is_active ? "Active" : "Inactive"} type="active" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button title="View customer" onClick={() => navigate(`/customers/${c.id}`)} className={btnGhostSm}><Eye size={13} /></button>
                          <button title="Edit customer" onClick={() => navigate(`/customers/${c.id}/edit`)} className={btnGhostSm}><Pencil size={13} /></button>
                          <button
                            title={c.is_active ? "Deactivate customer" : "Activate customer"}
                            onClick={() =>
                              askConfirm({
                                title: c.is_active ? "Deactivate customer?" : "Activate customer?",
                                message: c.is_active
                                  ? `${c.company_name} will be marked inactive. Existing enquiries and records are preserved.`
                                  : `${c.company_name} will be marked active again.`,
                                danger: c.is_active,
                                confirmLabel: c.is_active ? "Deactivate" : "Activate",
                                onConfirm: () => toggleActive(c),
                              })
                            }
                            className={btnGhostSm}
                          >
                            {c.is_active ? <Ban size={13} /> : <RotateCcw size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: one card per customer instead of a squeezed 9-column table. */}
            <div className="md:hidden divide-y divide-slate-100 relative">
              {loading && (
                <div className="absolute inset-0 bg-white/60 z-10 flex items-start justify-center pt-10">
                  <Loader2 size={18} className="text-teal-600 animate-spin" />
                </div>
              )}
              {data.results.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <button onClick={() => navigate(`/customers/${c.id}`)} className="font-semibold text-slate-800 hover:text-teal-700 text-left">
                      {c.company_name}
                    </button>
                    <StatusBadge status={c.is_active ? "Active" : "Inactive"} type="active" />
                  </div>
                  <div className="text-xs text-slate-500 mb-2"><Code>{c.customer_code}</Code></div>
                  <div className="space-y-1 text-sm text-slate-600 mb-3">
                    <p>Contact: {c.contact_person}</p>
                    <p>Mobile: {c.mobile}</p>
                    <p className="truncate">Email: {c.email}</p>
                    {c.gst_number && <p className="font-mono text-xs">GST: {c.gst_number}</p>}
                    {c.city && <p>{c.city}{c.state ? `, ${c.state}` : ""}</p>}
                    <p>Enquiries: {c.total_enquiries}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/customers/${c.id}`)} className={btnSecondary + " flex-1"}><Eye size={13} /> View</button>
                    <button onClick={() => navigate(`/customers/${c.id}/edit`)} className={btnSecondary + " flex-1"}><Pencil size={13} /> Edit</button>
                    <button
                      onClick={() =>
                        askConfirm({
                          title: c.is_active ? "Deactivate customer?" : "Activate customer?",
                          message: c.is_active
                            ? `${c.company_name} will be marked inactive. Existing enquiries and records are preserved.`
                            : `${c.company_name} will be marked active again.`,
                          danger: c.is_active,
                          confirmLabel: c.is_active ? "Deactivate" : "Activate",
                          onConfirm: () => toggleActive(c),
                        })
                      }
                      className={btnGhostSm}
                      title={c.is_active ? "Deactivate customer" : "Activate customer"}
                    >
                      {c.is_active ? <Ban size={14} /> : <RotateCcw size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination
              page={page} setPage={setPage} totalPages={data.total_pages} totalItems={data.count}
              pageSize={pageSize} onPageSizeChange={setPageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
