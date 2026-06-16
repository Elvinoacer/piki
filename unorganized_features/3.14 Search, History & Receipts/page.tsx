// app/(app)/history/page.tsx
// Feature 3.14 — Search, History & Receipts
// This is a Client Component page that boots the Zustand store on mount.
"use client";

import { useEffect } from "react";
import { useHistoryStore } from "@/store/history-store";
import { HistoryFilters } from "@/components/history/HistoryFilters";
import { TripCard } from "@/components/history/TripCard";
import { HistoryPagination } from "@/components/history/HistoryPagination";

export default function HistoryPage() {
  const { trips, isLoading, error, total, fetchHistory } = useHistoryStore();

  // Initial fetch on mount
  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trip History</h1>
        {!isLoading && total > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">{total} trip{total !== 1 ? "s" : ""} found</p>
        )}
      </div>

      {/* Filters */}
      <HistoryFilters />

      {/* Error state */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
          <button
            onClick={() => fetchHistory()}
            className="ml-2 underline text-red-800 hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && trips.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && trips.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4">🏍️</span>
          <p className="text-lg font-semibold text-gray-700">No trips found</p>
          <p className="text-sm text-gray-400 mt-1">
            Try adjusting your filters or search terms.
          </p>
        </div>
      )}

      {/* Trip list */}
      {trips.length > 0 && (
        <div className="space-y-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <HistoryPagination />
    </main>
  );
}
