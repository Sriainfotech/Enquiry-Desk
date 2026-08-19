import { useState } from "react";
import { AlertCircle, Loader2, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { messageFrom } from "../utils/apiError";
import PasswordInput from "../components/PasswordInput";
import { btnPrimary, inputCls, inputErrCls, labelCls } from "../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      // Backend already normalizes this to a generic message that never reveals
      // whether the username or the password was the wrong part.
      setError(messageFrom(err) || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="w-9 h-9 rounded-md bg-teal-600 flex items-center justify-center font-bold text-white text-sm">V</div>
          <div>
            <p className="text-slate-900 font-bold text-sm tracking-wide leading-none">Sria Infotech</p>
            <p className="text-slate-400 text-[11px] leading-none mt-1">Customer &amp; Enquiry Desk</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          <h1 className="text-lg font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-5">Use your Sria Infotech workspace credentials.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Username</label>
              <input
                className={error ? inputErrCls : inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-semibold text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-teal-600 font-medium hover:underline">Forgot Password?</Link>
              </div>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={error}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-[13px] text-red-500 flex items-center gap-1.5"><AlertCircle size={13} /> {error}</p>
            )}
            <button type="submit" className={btnPrimary + " w-full"} disabled={submitting}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
