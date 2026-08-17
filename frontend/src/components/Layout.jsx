import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { fetchDashboard } from "../api/enquiries";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import ToastStack from "./ToastStack";

export default function Layout() {
  const [dashboard, setDashboard] = useState(null);
  const mainRef = useRef(null);

  useEffect(() => {
    fetchDashboard().then(setDashboard).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <TopHeader dashboard={dashboard} />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6 lg:p-8 min-w-0">
          <Outlet context={{ refreshDashboard: () => fetchDashboard().then(setDashboard).catch(() => {}) }} />
        </main>
      </div>
      <ToastStack />
    </div>
  );
}
