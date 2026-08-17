import { ClipboardList, LayoutDashboard, Users } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { key: "customers", label: "Customers", icon: Users, to: "/customers" },
  { key: "enquiries", label: "Enquiries", icon: ClipboardList, to: "/enquiries" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const activeGroup = location.pathname.startsWith("/customers")
    ? "customers"
    : location.pathname.startsWith("/enquiries")
    ? "enquiries"
    : "dashboard";

  const initials = (user?.full_name || user?.username || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-52 bg-slate-900 flex flex-col flex-shrink-0 h-screen sticky top-0">
      <div className="h-16 px-4 flex items-center border-b border-slate-800/80 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center font-bold text-slate-900 text-sm flex-shrink-0">V</div>
          <div className="min-w-0">
            <p className="text-white font-bold text-[13px] tracking-wide leading-none">VANTAGE</p>
            <p className="text-slate-500 text-[10px] leading-none mt-1 truncate">Customer &amp; Enquiry Desk</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {ITEMS.map((it) => {
          const active = activeGroup === it.key;
          const Icon = it.icon;
          return (
            <NavLink
              key={it.key}
              to={it.to}
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
    </div>
  );
}
