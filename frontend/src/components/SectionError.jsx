import { AlertTriangle, RotateCcw } from "lucide-react";

export default function SectionError({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <AlertTriangle size={20} className="text-amber-500 mb-2" />
      <p className="text-sm text-slate-600">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 mt-3 text-sm text-teal-600 font-medium hover:underline">
          <RotateCcw size={13} /> Retry
        </button>
      )}
    </div>
  );
}
