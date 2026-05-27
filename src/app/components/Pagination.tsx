interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "default" | "minimal";
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  const addRange = (start: number, end: number) => {
    for (let i = start; i <= end; i++) pages.push(i);
  };

  pages.push(1);

  if (current <= 4) {
    addRange(2, 5);
    pages.push("...");
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push("...");
    addRange(total - 4, total);
  } else {
    pages.push("...");
    addRange(current - 1, current + 1);
    pages.push("...");
    pages.push(total);
  }

  return pages;
}

export default function Pagination({ currentPage, totalPages, onPageChange, variant = "default" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const isMinimal = variant === "minimal";

  const btnBase = isMinimal
    ? "flex h-6 min-w-6 items-center justify-center rounded-lg px-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    : "px-3 py-1.5 rounded-lg text-xs border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors";
  const btnActive = isMinimal
    ? "bg-[#0d2137] text-white hover:bg-[#0d2137] hover:text-white"
    : "text-white border-transparent";
  const navButtonClass = isMinimal
    ? "px-1 py-0.5 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
    : btnBase;
  const ellipsisClass = isMinimal
    ? "px-0.5 text-[11px] text-slate-400 select-none"
    : "px-2 py-1.5 text-xs text-slate-400 select-none";

  return (
    <div className={isMinimal ? "flex items-center gap-1" : "flex items-center gap-1"}>
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={navButtonClass}
      >
        Prev
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={`ellipsis-${idx}`} className={ellipsisClass}>
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`${btnBase} ${p === currentPage ? btnActive : ""}`}
            style={p === currentPage ? { backgroundColor: "#0d2137" } : {}}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={navButtonClass}
      >
        Next
      </button>
    </div>
  );
}
