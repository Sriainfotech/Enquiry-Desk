import { ChevronLeft, ChevronRight } from "lucide-react";

const DOTS = "…";

function paginationRange(current, total, siblingCount = 1) {
  const totalNumbers = siblingCount * 2 + 5; // first + last + current + 2*siblings + 2 possible dots
  if (totalNumbers >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < total - 1;

  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, DOTS, total];
  }
  if (showLeftDots && !showRightDots) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, i) => total - rightCount + i + 1);
    return [1, DOTS, ...rightRange];
  }
  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, DOTS, ...middleRange, DOTS, total];
}

export default function Pagination({
  page, setPage, totalPages, totalItems, pageSize, onPageSizeChange, pageSizeOptions = [10, 20, 50, 100],
}) {
  if (totalItems === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);
  const pages = paginationRange(page, Math.max(totalPages, 1));

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 flex-wrap gap-3">
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-500">
          Showing <span className="font-medium text-slate-700">{start}–{end}</span> of{" "}
          <span className="font-medium text-slate-700">{totalItems.toLocaleString("en-IN")}</span>
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Rows per page
            <select
              className="h-7 pl-2 pr-6 border border-slate-200 rounded-md text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          {/* Full numbered range on larger screens; a compact "page X / Y" on mobile
              where a row of 5-7 number buttons wouldn't comfortably fit. */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((p, i) =>
              p === DOTS ? (
                <span key={`dots-${i}`} className="px-1.5 text-xs text-slate-400">{DOTS}</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`min-w-[26px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
                    p === page ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <span className="sm:hidden text-xs font-medium text-slate-600 px-2 whitespace-nowrap">
            {page} / {totalPages}
          </span>
          <button
            className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
