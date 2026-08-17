import { AlertCircle } from "lucide-react";
import { btnDanger, btnPrimary, btnSecondary } from "./ui";

export default function ConfirmDialog({ dialog, onClose }) {
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dialog.danger ? "bg-red-100" : "bg-amber-100"}`}>
            <AlertCircle size={18} className={dialog.danger ? "text-red-600" : "text-amber-600"} />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">{dialog.title}</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">{dialog.message}</p>
        <div className="flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button
            className={dialog.danger ? btnDanger : btnPrimary}
            onClick={() => { dialog.onConfirm(); onClose(); }}
          >
            {dialog.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
