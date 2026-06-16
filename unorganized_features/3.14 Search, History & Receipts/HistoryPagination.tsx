// components/history/HistoryPagination.tsx
// Feature 3.14 — Search, History & Receipts
"use client";

import { useHistoryStore } from "@/store/history-store";

export function HistoryPagination() {
  const { filters, total, totalPages, setFilters, isLoading } = useHistoryStore();
  const { page, pageSize } = filters;

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages || isLoading) return;
    setFilters({ page: p });
  };

  // Show a window of pages around current
  const pages: (number | "…")[] = [];
  const WINDOW = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - WINDOW && i <= page + WINDOW)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>
        Showing {from}–{to} of {total} trips
      </span>
      <div className="flex items-center gap-1">
        <PageButton onClick={() => goTo(page - 1)} disabled={page <= 1 || isLoading} label="‹" />
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <PageButton
              key={p}
              onClick={() => goTo(p as number)}
              disabled={isLoading}
              label={String(p)}
              active={p === page}
            />
          )
        )}
        <PageButton onClick={() => goTo(page + 1)} disabled={page >= totalPages || isLoading} label="›" />
      </div>
    </div>
  );
}

function PageButton({
  onClick,
  disabled,
  label,
  active = false,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-8 h-8 rounded-lg text-sm font-medium transition-colors
        ${active
          ? "bg-blue-600 text-white"
          : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
        }
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      {label}
    </button>
  );
}
