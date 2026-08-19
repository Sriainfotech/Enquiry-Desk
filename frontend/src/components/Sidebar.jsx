import { useEffect } from "react";
import { ClipboardList, LayoutDashboard, Users, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { key: "customers", label: "Customers", icon: Users, to: "/customers" },
  { key: "enquiries", label: "Enquiries", icon: ClipboardList, to: "/enquiries" },
];

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const { user } = useAuth();
  const location = useLocation();
  const activeGroup = location.pathname.startsWith("/customers")
    ? "customers"
    : location.pathname.startsWith("/enquiries")
    ? "enquiries"
    : "dashboard";

  // Below md the sidebar renders as an overlay drawer instead of taking layout
  // space — lock page scroll behind it while it's open, same as any modal.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  const initials = (user?.full_name || user?.username || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navContent = (
    <>
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center font-bold text-slate-900 text-sm flex-shrink-0">S</div>
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] tracking-wide leading-none">Sria Infotech</p>
            <p className="text-slate-500 text-[10px] leading-none mt-1 truncate">Customer &amp; Enquiry Desk</p>
          </div>
        </div>
        <button onClick={onCloseMobile} className="md:hidden p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white flex-shrink-0">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {ITEMS.map((it) => {
          const active = activeGroup === it.key;
          const Icon = it.icon;
          return (
            <NavLink
              key={it.key}
              to={it.to}
              onClick={onCloseMobile}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                active ? "bg-teal-500/10 text-white" : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
              }`}
            >
              <Icon size={16} className={active ? "text-teal-400" : ""} />
              {it.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-3 py-3 border-t border-slate-800/80 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md">
          <div className="w-8 h-8 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-semibold flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.full_name || user?.username}</p>
            <p className="text-[10px] text-slate-500 truncate">Team workspace</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / tablet: sidebar is always part of the layout. */}
      <div className="hidden md:flex w-52 bg-slate-900 flex-col flex-shrink-0 h-screen sticky top-0">
        {navContent}
      </div>

      {/* Mobile: sidebar becomes a slide-in drawer over the content. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onCloseMobile} />
          <div className="absolute left-0 top-0 h-full w-64 max-w-[80vw] bg-slate-900 flex flex-col shadow-xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
