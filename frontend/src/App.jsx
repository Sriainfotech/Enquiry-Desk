import { Loader2 } from "lucide-react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { ConfirmProvider } from "./hooks/useConfirm";
import { ToastProvider } from "./hooks/useToast";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersListPage from "./pages/CustomersListPage";
import CustomerFormPage from "./pages/CustomerFormPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import EnquiriesListPage from "./pages/EnquiriesListPage";
import EnquiryFormPage from "./pages/EnquiryFormPage";
import EnquiryDetailPage from "./pages/EnquiryDetailPage";
import ActivityHistoryPage from "./pages/ActivityHistoryPage";

function FullScreenLoader() {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={26} className="text-teal-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading Vantage…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
              <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<DashboardPage />} />
                <Route path="customers" element={<CustomersListPage />} />
                <Route path="customers/new" element={<CustomerFormPage mode="add" />} />
                <Route path="customers/:id/edit" element={<CustomerFormPage mode="edit" />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="enquiries" element={<EnquiriesListPage />} />
                <Route path="enquiries/new" element={<EnquiryFormPage />} />
                <Route path="enquiries/activity" element={<ActivityHistoryPage />} />
                <Route path="enquiries/:id" element={<EnquiryDetailPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
