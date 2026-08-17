import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Building2, ChevronDown, ClipboardList, FileText, Package, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listCustomers } from "../api/customers";
import { listEnquiries } from "../api/enquiries";
import { useAuth } from "../hooks/useAuth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { focusRing } from "./ui";

export default function TopHeader({ dashboard }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({ customers: [], enquiries: [] });
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResults({ customers: [], enquiries: [] });
      return;
    }
    let cancelled = false;
    Promise.all([
      listCustomers({ search: q, page_size: 4 }),
      listEnquiries({ search: q, page_size: 4 }),
    ]).then(([customers, enquiries]) => {
      if (!cancelled) setResults({ customers: customers.results, enquiries: enquiries.results });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const notifications = [];
  if (dashboard) {
    if (dashboard.pending_quotations > 0) {
      notifications.push({ icon: FileText, text: `${dashboard.pending_quotations} quotation${dashboard.pending_quotations > 1 ? "s" : ""} awaiting a decision`, tone: "text-amber-600 bg-amber-50" });
    }
    if (dashboard.invoices_overdue_count > 0) {
      notifications.push({ icon: AlertTriangle, text: `${dashboard.invoices_overdue_count} invoice${dashboard.invoices_overdue_count > 1 ? "s" : ""} past the due date`, tone: "text-red-600 bg-red-50" });
    }
    if (dashboard.quotations_ready_to_convert_count > 0) {
      notifications.push({ icon: Package, text: `${dashboard.quotations_ready_to_convert_count} accepted quotation${dashboard.quotations_ready_to_convert_count > 1 ? "s" : ""} ready to convert to an order`, tone: "text-blue-600 bg-blue-50" });
    }
  }

  function goTo(path) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center gap-4 px-6 lg:px-8 flex-shrink-0 sticky top-0 z-20">
      <div className="relative flex-1 max-w-md" ref={searchWrapRef}>
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 placeholder:text-slate-400"
          placeholder="Search customers, enquiries, quotations, orders…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {open && query.trim() && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
            {results.customers.length === 0 && results.enquiries.length === 0 ? (
              <p className="px-3 py-3 text-sm text-slate-400">No matches for "{query}".</p>
            ) : (
              <>
                {results.customers.length > 0 && (
                  <div className="py-1">
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Customers</p>
                    {results.customers.map((c) => (
                      <button key={c.id} onClick={() => goTo(`/customers/${c.id}`)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                        <Building2 size={14} className="text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">{c.company_name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{c.contact_person}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {results.enquiries.length > 0 && (
                  <div className="py-1 border-t border-slate-100">
                    <p className="px-3 pt-1.5 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Enquiries</p>
                    {results.enquiries.map((e) => (
                      <button key={e.id} onClick={() => goTo(`/enquiries/${e.id}`)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                        <ClipboardList size={14} className="text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate font-mono">{e.enquiry_number}</p>
                          <p className="text-[11px] text-slate-400 truncate">{e.customer_detail?.company_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className={`relative p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ${focusRing}`}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 z-30 mt-2 w-80 bg-white border border-slate-200 rounded-md shadow-lg">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Notifications</p>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400 text-center">You're all caught up.</p>
              ) : (
                <div className="py-1">
                  {notifications.map((n, i) => {
                    const Icon = n.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${n.tone}`}>
                          <Icon size={13} />
                        </div>
                        <p className="text-sm text-slate-700 leading-snug">{n.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative" ref={userRef}>
          <button onClick={() => setUserOpen((o) => !o)} className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-md hover:bg-slate-100 transition-colors ${focusRing}`}>
            <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
              {(user?.full_name || user?.username || "U").slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">{user?.full_name || user?.username}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${userOpen ? "rotate-180" : ""}`} />
          </button>
          {userOpen && (
            <div className="absolute right-0 z-30 mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg py-2">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">{user?.full_name || user?.username}</p>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email || "Team workspace · Vantage"}</p>
              </div>
              <button
                onClick={() => { setUserOpen(false); logout(); }}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
