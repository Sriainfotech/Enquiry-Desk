import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { fetchDashboard } from "../api/enquiries";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import ToastStack from "./ToastStack";

export default function Layout() {
  const [dashboard, setDashboard] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    fetchDashboard().then(setDashboard).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <TopHeader dashboard={dashboard} onOpenMenu={() => setMobileNavOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 min-w-0">
          <Outlet context={{ refreshDashboard: () => fetchDashboard().then(setDashboard).catch(() => {}) }} />
        </main>
      </div>
      <ToastStack />
    </div>
  );
}
