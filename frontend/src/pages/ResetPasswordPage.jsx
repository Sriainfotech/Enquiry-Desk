import { useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { resetPassword } from "../api/auth";
import PasswordInput from "../components/PasswordInput";
import { btnPrimary, labelCls } from "../components/ui";
import { messageFrom } from "../utils/apiError";
import * as v from "../utils/validators";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [linkError, setLinkError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    const pwErr = v.password(newPassword);
    if (pwErr) errs.new_password = pwErr;
    const confirmErr = v.confirmPassword(confirmPassword, newPassword);
    if (confirmErr) errs.confirm_password = confirmErr;
    setErrors(errs);
    setLinkError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await resetPassword({ uid, token, new_password: newPassword, confirm_password: confirmPassword });
      setSuccess(true);
    } catch (err) {
      const fieldErrs = {};
      if (err?.errors) {
        for (const [key, msgs] of Object.entries(err.errors)) {
          fieldErrs[key] = Array.isArray(msgs) ? msgs.join(" ") : String(msgs);
        }
      }
      if (Object.keys(fieldErrs).length) {
        setErrors(fieldErrs);
      } else {
        // uid/token invalid-or-expired comes back as a plain top-level detail, not a field error.
        setLinkError(messageFrom(err));
      }
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
            <p className="text-slate-900 font-bold text-sm tracking-wide leading-none">VANTAGE</p>
            <p className="text-slate-400 text-[11px] leading-none mt-1">Customer &amp; Enquiry Desk</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          {success ? (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <h1 className="text-lg font-bold text-slate-900 mb-1.5">Password Reset Successful</h1>
              <p className="text-sm text-slate-500">Your password has been updated successfully.</p>
              <button className={btnPrimary + " w-full mt-5 justify-center"} onClick={() => navigate("/login", { replace: true })}>
                Go to Login
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-slate-900 mb-1">Reset Password</h1>
              <p className="text-sm text-slate-500 mb-5">Choose a new password for your account.</p>

              {linkError && (
                <div className="mb-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2.5">
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {linkError}{" "}
                    <Link to="/forgot-password" className="underline font-medium">Request a new link</Link>.
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>New Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    error={errors.new_password}
                    autoFocus
                    autoComplete="new-password"
                  />
                  {errors.new_password ? (
                    <p className="text-[11px] text-red-500 mt-1">{errors.new_password}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">At least 8 characters, with upper/lowercase, a number and a special character.</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Confirm New Password <span className="text-red-500">*</span></label>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={errors.confirm_password}
                    autoComplete="new-password"
                  />
                  {errors.confirm_password && <p className="text-[11px] text-red-500 mt-1">{errors.confirm_password}</p>}
                </div>
                <button type="submit" className={btnPrimary + " w-full"} disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                  {submitting ? "Resetting…" : "Reset Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
