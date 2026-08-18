import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { inputCls, inputErrCls } from "./ui";

const GAP = 4; // px between the trigger and the floating panel

export default function SearchableSelect({
  value, onChange, options, placeholder = "Select…", error, clearable = true, searchable = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [coords, setCoords] = useState(null);
  const wrapRef = useRef(null); // wraps the trigger button (for outside-click + measuring)
  const panelRef = useRef(null); // the portaled floating panel
  const searchRef = useRef(null);

  const normalized = useMemo(
    () => options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
    [options]
  );
  const selected = normalized.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalized, query]);

  // Trying to guess the panel's full content height and flip up whenever it "doesn't
  // quite fit" is what caused short lists (e.g. Unit's 6 options) to pop open upward
  // even with plenty of room below — any estimate can be borderline-wrong. Instead:
  // prefer opening down always, only flip up when space below is genuinely too small
  // to be usable, and clamp the rendered height to whatever room actually exists so
  // it never needs to be exactly right to avoid overflowing the viewport.
  const MIN_USABLE_HEIGHT = 160; // below this, scrolling a list open downward stops being usable
  const MAX_PANEL_HEIGHT = 280; // search bar + max option rows, generous upper bound

  function updatePosition() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < MIN_USABLE_HEIGHT && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(MIN_USABLE_HEIGHT, Math.min(MAX_PANEL_HEIGHT, available));
    setCoords((prev) => {
      const next = {
        left: rect.left,
        width: rect.width,
        openUp,
        maxHeight,
        top: openUp ? undefined : rect.bottom + GAP,
        bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      };
      if (prev && prev.left === next.left && prev.width === next.width && prev.openUp === next.openUp && prev.top === next.top && prev.bottom === next.bottom && prev.maxHeight === next.maxHeight) {
        return prev;
      }
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function onDocMouseDown(e) {
      if (wrapRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    // capture:true so this fires for scroll on any nested scrollable ancestor too, not just window.
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      if (searchable) setTimeout(() => searchRef.current && searchRef.current.focus(), 0);
    }
  }, [open, searchable]);

  function selectOption(opt) {
    onChange(opt.value);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${error ? inputErrCls : inputCls} flex items-center justify-between text-left ${!selected ? "text-slate-400" : ""}`}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <span className="flex items-center gap-1 flex-shrink-0 ml-2">
          {clearable && selected && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: coords.top, bottom: coords.bottom, left: coords.left, width: coords.width, maxHeight: coords.maxHeight }}
          className="z-[70] bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden flex flex-col"
        >
          {searchable && (
            <div className="p-2 border-b border-slate-100 flex-shrink-0">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
                  placeholder="Search…"
                  className="w-full h-8 pl-8 pr-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto py-1 min-h-0">
            {filtered.length === 0 && <p className="px-3 py-2.5 text-sm text-slate-400">No matches.</p>}
            {filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => selectOption(o)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  i === highlight ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:bg-slate-50"
                } ${o.value === value ? "font-medium" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={14} className="text-teal-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
