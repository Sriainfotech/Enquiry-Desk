import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api/auth";
import { btnPrimary, inputCls, inputErrCls, labelCls } from "../components/ui";
import { email as validateEmail } from "../utils/validators";
import { fieldErrorsFrom, messageFrom } from "../utils/apiError";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      const fieldErrs = fieldErrorsFrom(err);
      setError(fieldErrs.email || messageFrom(err));
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
          {sent ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-1.5">Check your email</h1>
              <p className="text-sm text-slate-500">
                If an account exists with this email, a password reset link has been sent.
              </p>
              <Link to="/login" className={btnPrimary + " w-full mt-5 justify-center"}>
                <ArrowLeft size={15} /> Back to Login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-900 mb-1">Forgot Password?</h1>
              <p className="text-sm text-slate-500 mb-5">
                Enter your registered email address and we'll send you a password reset link.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Email <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      className={(error ? inputErrCls : inputCls) + " pl-9"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      autoFocus
                      autoComplete="email"
                    />
                  </div>
                  {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
                </div>
                <button type="submit" className={btnPrimary + " w-full"} disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {submitting ? "Sending…" : "Send Reset Link"}
                </button>
              </form>

              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 mt-5">
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
