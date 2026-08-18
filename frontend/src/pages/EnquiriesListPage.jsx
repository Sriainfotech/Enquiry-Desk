import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, ChevronDown, Clock, ClipboardList, Eye, Filter, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCustomer } from "../api/customers";
import { listEnquiries, patchEnquiry } from "../api/enquiries";
import AsyncCustomerSelect from "../components/AsyncCustomerSelect";
import Code from "../components/Code";
import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import SearchableSelect from "../components/SearchableSelect";
import StatusBadge from "../components/StatusBadge";
import { btnGhost, btnGhostSm, btnPrimary, btnSecondary, cardCls, inputCls, labelCls, tableHeadCls } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useToast } from "../hooks/useToast";
import { formatCurrency, formatDate } from "../utils/format";
import {
  BUSINESS_LINES, ENQUIRY_SORT_OPTIONS, ENQUIRY_SOURCES, ENQUIRY_STATUSES, INVOICE_STATUSES, ORDER_STATUSES,
  PAGE_SIZE, PAYMENT_STATUSES, PRIORITIES, QUOTATION_STATUSES,
} from "../constants";

// Primary-row filters apply instantly. Everything else lives in the "More Filters"
// popover and only commits to real state when the user clicks Apply — so opening the
// popover to look around never triggers a fetch.
const PRIMARY_FILTER_KEYS = ["business_line", "status", "priority"];
const POPOVER_FILTER_KEYS = ["enquiry_source", "quotation_status", "order_status", "invoice_status", "payment_status", "sales_person", "date_from", "date_to"];
const FILTER_KEYS = [...PRIMARY_FILTER_KEYS, ...POPOVER_FILTER_KEYS];
const FILTER_LABELS = {
  business_line: "Business Line", status: "Status", priority: "Priority", enquiry_source: "Source",
  quotation_status: "Quotation", order_status: "Order", invoice_status: "Invoice", payment_status: "Payment",
  sales_person: "Sales Person", date_from: "From", date_to: "To",
};
const EMPTY_POPOVER_FILTERS = Object.fromEntries(POPOVER_FILTER_KEYS.map((k) => [k, ""]));

function paramsToFilters(sp) {
  const f = {};
  FILTER_KEYS.forEach((k) => { f[k] = sp.get(k) || ""; });
  return f;
}

// Floating panel anchored to the "More Filters" trigger — portaled to <body> with
// fixed coordinates (same escape-the-clipping-ancestor technique as SearchableSelect)
// so it can't be cut off by the toolbar card's overflow.
function MoreFiltersPopover({ anchorRef, draft, setDraft, onApply, onClear, onClose }) {
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(620, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      setCoords({ left, top: rect.bottom + 6, width });
    }
    update();
    function onMouseDown(e) {
      if (anchorRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      onClose();
    }
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  if (!coords) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
      className="z-[70] bg-white border border-slate-200 rounded-lg shadow-xl p-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Enquiry Source</label>
          <SearchableSelect value={draft.enquiry_source} onChange={(v) => setField("enquiry_source", v)} placeholder="Any source" options={ENQUIRY_SOURCES} />
        </div>
        <div>
          <label className={labelCls}>Sales Person</label>
          <input className={inputCls} placeholder="Sales person" value={draft.sales_person} onChange={(e) => setField("sales_person", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Quotation Status</label>
          <SearchableSelect value={draft.quotation_status} onChange={(v) => setField("quotation_status", v)} placeholder="Any status" options={QUOTATION_STATUSES} />
        </div>
        <div>
          <label className={labelCls}>Order Status</label>
          <SearchableSelect value={draft.order_status} onChange={(v) => setField("order_status", v)} placeholder="Any status" options={ORDER_STATUSES} />
        </div>
        <div>
          <label className={labelCls}>Invoice Status</label>
          <SearchableSelect value={draft.invoice_status} onChange={(v) => setField("invoice_status", v)} placeholder="Any status" options={INVOICE_STATUSES} />
        </div>
        <div>
          <label className={labelCls}>Payment Status</label>
          <SearchableSelect value={draft.payment_status} onChange={(v) => setField("payment_status", v)} placeholder="Any status" options={PAYMENT_STATUSES} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Date Range</label>
          <div className="flex items-center gap-2">
            <input type="date" className={inputCls} value={draft.date_from} onChange={(e) => setField("date_from", e.target.value)} title="From date" />
            <span className="text-xs text-slate-400 flex-shrink-0">to</span>
            <input type="date" className={inputCls} value={draft.date_to} onChange={(e) => setField("date_to", e.target.value)} title="To date" min={draft.date_from || undefined} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
        <button onClick={onClear} className={btnSecondary}>Clear</button>
        <button onClick={onApply} className={btnPrimary}>Apply Filters</button>
      </div>
    </div>,
    document.body
  );
}

export default function EnquiriesListPage() {
  const navigate = useNavigate();
  const askConfirm = useConfirm();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [customerId, setCustomerId] = useState(searchParams.get("customer") ? Number(searchParams.get("customer")) : null);
  const [customerLabel, setCustomerLabel] = useState("");
  const [ordering, setOrdering] = useState(searchParams.get("ordering") || "-enquiry_date");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("page_size")) || PAGE_SIZE);

  const [data, setData] = useState({ results: [], count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(EMPTY_POPOVER_FILTERS);
  const moreBtnRef = useRef(null);

  // If the page loaded with ?customer=<id> from a shared URL, fetch its label once.
  useEffect(() => {
    if (customerId && !customerLabel) {
      getCustomer(customerId).then((c) => setCustomerLabel(c.company_name)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (ordering !== "-enquiry_date") next.set("ordering", ordering);
    if (page !== 1) next.set("page", String(page));
    if (pageSize !== PAGE_SIZE) next.set("page_size", String(pageSize));
    setSearchParams(next, { replace: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filters, customerId, ordering, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEnquiries({
      search: debouncedSearch || undefined,
      customer: customerId || undefined,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      ordering,
      page,
      page_size: pageSize,
    })
      .then((res) => { if (!cancelled) setData(res); })
      .finally(() => { if (!cancelled) { setLoading(false); setInitialLoad(false); } });
    return () => { cancelled = true; };
  }, [debouncedSearch, filters, customerId, ordering, page, pageSize]);

  async function cancelEnquiry(enquiry) {
    await patchEnquiry(enquiry.id, { status: "Cancelled" });
    showToast("Enquiry cancelled.", "success");
    setData((d) => ({ ...d, results: d.results.map((e) => (e.id === enquiry.id ? { ...e, status: "Cancelled" } : e)) }));
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function clearAll() {
    setSearch("");
    setFilters(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
    setDraftFilters(EMPTY_POPOVER_FILTERS);
    setCustomerId(null);
    setCustomerLabel("");
    setOrdering("-enquiry_date");
  }

  function openMoreFilters() {
    setDraftFilters(Object.fromEntries(POPOVER_FILTER_KEYS.map((k) => [k, filters[k]])));
    setMoreOpen(true);
  }
  function applyMoreFilters() {
    setFilters((f) => ({ ...f, ...draftFilters }));
    setMoreOpen(false);
  }
  function clearMoreFilters() {
    setDraftFilters(EMPTY_POPOVER_FILTERS);
  }

  const activeChips = useMemo(() => {
    const chips = FILTER_KEYS.filter((k) => filters[k]).map((k) => ({ key: k, label: `${FILTER_LABELS[k]}: ${filters[k]}`, clear: () => setFilter(k, "") }));
    if (customerId) chips.push({ key: "customer", label: `Customer: ${customerLabel || customerId}`, clear: () => { setCustomerId(null); setCustomerLabel(""); } });
    return chips;
  }, [filters, customerId, customerLabel]);
  const activeFilterCount = activeChips.length;
  const moreFiltersActiveCount = POPOVER_FILTER_KEYS.filter((k) => filters[k]).length;

  const customerName = (e) => e.customer_detail?.company_name || "—";

  return (
    <div>
      <PageHeader
        title="Enquiries"
        subtitle="Track enquiries from first contact through to invoicing"
        action={
          <div className="flex items-center gap-2">
            <button className={btnGhost} onClick={() => navigate("/enquiries/activity")}><Clock size={15} /> Activity Log</button>
            <button className={btnPrimary} onClick={() => navigate("/enquiries/new")}><Plus size={16} /> New Enquiry</button>
          </div>
        }
      />

      <div className={`${cardCls} p-4 mb-4`}>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px] sm:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={inputCls + " pl-9"} placeholder="Search by enquiry number, customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-full sm:w-[200px]">
            <AsyncCustomerSelect value={customerId} valueLabel={customerLabel} onChange={(id, label) => { setCustomerId(id); setCustomerLabel(label || ""); }} />
          </div>
          <div className="w-full sm:w-[170px]">
            <SearchableSelect value={filters.business_line} onChange={(v) => setFilter("business_line", v)} placeholder="Business Line" options={BUSINESS_LINES} />
          </div>
          <div className="w-full sm:w-[150px]">
            <SearchableSelect value={filters.status} onChange={(v) => setFilter("status", v)} placeholder="Status" options={ENQUIRY_STATUSES} />
          </div>
          <div className="w-full sm:w-[130px]">
            <SearchableSelect value={filters.priority} onChange={(v) => setFilter("priority", v)} placeholder="Priority" options={PRIORITIES} />
          </div>
          <div className="w-full sm:w-[180px]">
            <SearchableSelect value={ordering} onChange={setOrdering} clearable={false} searchable={false} placeholder="Sort" options={ENQUIRY_SORT_OPTIONS} />
          </div>
          <div ref={moreBtnRef}>
            <button
              onClick={() => (moreOpen ? setMoreOpen(false) : openMoreFilters())}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 h-[38px] rounded-md border transition-colors ${
                moreOpen || moreFiltersActiveCount > 0
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-300 text-slate-600 hover:border-slate-400"
              }`}
            >
              <Filter size={13} /> More Filters
              {moreFiltersActiveCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-teal-600 text-white text-[10px] font-semibold">
                  {moreFiltersActiveCount}
                </span>
              )}
              <ChevronDown size={13} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {(activeFilterCount > 0 || search) && (
            <button onClick={clearAll} className="text-xs text-teal-600 font-medium hover:underline ml-auto">
              Clear All ({activeFilterCount + (search ? 1 : 0)})
            </button>
          )}
        </div>

        {moreOpen && (
          <MoreFiltersPopover
            anchorRef={moreBtnRef}
            draft={draftFilters}
            setDraft={setDraftFilters}
            onApply={applyMoreFilters}
            onClear={clearMoreFilters}
            onClose={() => setMoreOpen(false)}
          />
        )}

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
        {initialLoad ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={20} className="text-teal-600 animate-spin" /></div>
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No enquiries found"
            message={search || activeFilterCount ? "No results match your current filters." : "Create your first enquiry to get started."}
            action={
              search || activeFilterCount ? (
                <button className={btnPrimary} onClick={clearAll}>Clear Filters</button>
              ) : (
                <button className={btnPrimary} onClick={() => navigate("/enquiries/new")}><Plus size={16} /> New Enquiry</button>
              )
            }
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
                    <th className="px-5 py-2.5 font-semibold">Enquiry #</th>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Customer</th>
                    <th className="px-3 py-2.5 font-semibold">Business Line</th>
                    <th className="px-3 py-2.5 font-semibold">Requirement</th>
                    <th className="px-3 py-2.5 font-semibold text-center">Qty</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Quotation Value</th>
                    <th className="px-3 py-2.5 font-semibold">Quotation</th>
                    <th className="px-3 py-2.5 font-semibold">Order</th>
                    <th className="px-3 py-2.5 font-semibold">Invoice</th>
                    <th className="px-3 py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((e) => (
                    <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                      <td className="px-5 py-3"><Code>{e.enquiry_number}</Code></td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{formatDate(e.enquiry_date)}</td>
                      <td className="px-3 py-3">
                        <button onClick={() => navigate(`/customers/${e.customer}`)} className="text-slate-700 hover:text-teal-700 font-medium text-left">
                          {customerName(e)}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{e.business_line}</td>
                      <td className="px-3 py-3 text-slate-500 truncate max-w-[150px]">{e.first_requirement || "—"}</td>
                      <td className="px-3 py-3 text-center text-slate-600">{e.total_quantity}</td>
                      <td className="px-3 py-3 text-right font-medium text-slate-800 whitespace-nowrap">{formatCurrency(e.quotation?.total_value || e.quotation?.value)}</td>
                      <td className="px-3 py-3"><StatusBadge status={e.quotation?.status} type="quotation" /></td>
                      <td className="px-3 py-3"><StatusBadge status={e.order?.status} type="order" /></td>
                      <td className="px-3 py-3"><StatusBadge status={e.invoice?.status} type="invoice" /></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button title="View" onClick={() => navigate(`/enquiries/${e.id}`)} className={btnGhostSm}><Eye size={13} /></button>
                          <button title="Edit" onClick={() => navigate(`/enquiries/${e.id}?edit=1`)} className={btnGhostSm}><Pencil size={13} /></button>
                          {e.status !== "Cancelled" && (
                            <button
                              title="Cancel"
                              onClick={() => askConfirm({
                                title: "Cancel enquiry?",
                                message: `${e.enquiry_number} will be marked as Cancelled. The record and its history are preserved.`,
                                danger: true,
                                confirmLabel: "Cancel Enquiry",
                                onConfirm: () => cancelEnquiry(e),
                              })}
                              className={btnGhostSm}
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
