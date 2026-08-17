import React from "react";
import { ChevronRight } from "lucide-react";

export default function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-3 flex-wrap">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />}
          {it.onClick ? (
            <button onClick={it.onClick} className="hover:text-teal-700 font-medium transition-colors">{it.label}</button>
          ) : (
            <span className="text-slate-700 font-semibold">{it.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
