import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast } from "../hooks/useToast";

export default function ToastStack() {
  const { toasts, dismissToast } = useToast();
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 sm:w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-2 px-3.5 py-3 rounded-lg shadow-lg border text-sm ${
            t.type === "error" ? "bg-red-50 border-red-200 text-red-700"
            : t.type === "info" ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {t.type === "error" ? <XCircle size={16} className="mt-0.5 flex-shrink-0" />
            : t.type === "info" ? <Info size={16} className="mt-0.5 flex-shrink-0" />
            : <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="opacity-50 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
