// components/history/HistoryFilters.tsx
// Feature 3.14 — Search, History & Receipts
"use client";

import { useCallback, useRef } from "react";
import { useHistoryStore } from "@/store/history-store";
import type { TripType, TripStatus } from "@/types/history";

const TRIP_TYPES: { label: string; value: TripType | "ALL" }[] = [
  { label: "All Types", value: "ALL" },
  { label: "Boda Ride", value: "RIDE" },
  { label: "Parcel Delivery", value: "PARCEL" },
  { label: "Food/Errand", value: "FOOD" },
  { label: "Errand", value: "ERRAND" },
];

const TRIP_STATUSES: { label: string; value: TripStatus | "ALL" }[] = [
  { label: "All Statuses", value: "ALL" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Requested", value: "REQUESTED" },
];

export function HistoryFilters() {
  const { filters, setFilters, resetFilters, isLoading } = useHistoryStore();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input to avoid firing on every keystroke
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        setFilters({ search: value });
      }, 350);
    },
    [setFilters]
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.type !== "ALL" ||
    filters.status !== "ALL";

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <SearchIcon />
        </span>
        <input
          type="text"
          placeholder="Search pickup or drop-off address…"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          className="
            w-full pl-10 pr-4 py-2.5 text-sm
            rounded-xl border border-gray-200 bg-white
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            placeholder-gray-400
          "
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}
      </div>

      {/* Row: date range + type + status */}
      <div className="flex flex-wrap gap-2">
        {/* Date From */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">From</label>
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            max={filters.dateTo ?? undefined}
            onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 whitespace-nowrap">To</label>
          <input
            type="date"
            value={filters.dateTo ?? ""}
            min={filters.dateFrom ?? undefined}
            onChange={(e) => setFilters({ dateTo: e.target.value || null })}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Trip Type */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ type: e.target.value as TripType | "ALL" })}
          className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {TRIP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as TripStatus | "ALL" })}
          className="text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {TRIP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-sm px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── Icon helpers ───────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1116.65 16.65z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
