import { X } from "lucide-react";
import { focusRing } from "./ui";

export default function Modal({ title, description, onClose, children, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-lg">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} className={`p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex-shrink-0 ${focusRing}`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
