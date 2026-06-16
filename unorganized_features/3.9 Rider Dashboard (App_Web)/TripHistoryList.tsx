"use client";
// components/rider/TripHistoryList.tsx
// Trip history with client ratings received — PRD §3.9

import { useState, useCallback } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { TripHistoryItem, TripStatus } from "@/types/rider-dashboard";

const STATUS_STYLES: Record<TripStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-600" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  REQUESTED: { label: "Requested", className: "bg-gray-100 text-gray-600" },
  ACCEPTED: { label: "Accepted", className: "bg-indigo-100 text-indigo-700" },
  ARRIVING: { label: "Arriving", className: "bg-purple-100 text-purple-700" },
  ARRIVED: { label: "Arrived", className: "bg-teal-100 text-teal-700" },
};

export function TripHistoryList() {
  const {
    tripHistory,
    tripHistoryHasMore,
    tripHistoryPage,
    incrementHistoryPage,
    appendTripHistory,
  } = useRiderDashboardStore();

  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (loadingMore || !tripHistoryHasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = tripHistoryPage + 1;
      const res = await fetch(`/api/rider/trips?page=${nextPage}&pageSize=20`);
      const data = await res.json();
      appendTripHistory(data.trips, data.hasMore);
      incrementHistoryPage();
    } catch {
      // handle error silently — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, tripHistoryHasMore, tripHistoryPage, appendTripHistory, incrementHistoryPage]);

  if (tripHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <span className="text-4xl mb-3">🏍️</span>
        <p className="text-sm">No trips yet. Go online to start earning!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tripHistory.map((trip) => (
        <TripHistoryCard
          key={trip.id}
          trip={trip}
          expanded={expandedId === trip.id}
          onToggle={() =>
            setExpandedId((id) => (id === trip.id ? null : trip.id))
          }
        />
      ))}

      {tripHistoryHasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-2 py-3 text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more trips"}
        </button>
      )}
    </div>
  );
}

function TripHistoryCard({
  trip,
  expanded,
  onToggle,
}: {
  trip: TripHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusStyle = STATUS_STYLES[trip.status];
  const dateStr = trip.completedAt
    ? new Date(trip.completedAt).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        {/* Client avatar */}
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {trip.clientAvatar ? (
            <img
              src={trip.clientAvatar}
              alt={trip.clientName}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            trip.clientName[0]?.toUpperCase()
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-800 truncate">
              {trip.clientName}
            </p>
            <span
              className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle.className}`}
            >
              {statusStyle.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            → {trip.dropoffAddress}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400">{dateStr}</span>
            {trip.ratingReceived !== null && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                <span>★</span>
                <span>{trip.ratingReceived}</span>
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">
            KES {trip.fare.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">{trip.distanceKm.toFixed(1)} km</p>
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
          <div className="flex flex-col gap-1.5">
            <RouteRow label="From" address={trip.pickupAddress} color="bg-emerald-500" />
            <div className="ml-2 w-px h-3 bg-gray-300" />
            <RouteRow label="To" address={trip.dropoffAddress} color="bg-red-500" />
          </div>

          {trip.ratingComment && (
            <p className="mt-3 text-xs text-gray-600 italic bg-white rounded-lg px-3 py-2 border border-gray-200">
              "{trip.ratingComment}"
            </p>
          )}

          <div className="mt-3 flex gap-3 text-xs text-gray-500">
            <span>
              Payment:{" "}
              <strong className="text-gray-700">{trip.paymentMethod}</strong>
            </span>
            <span>
              Type:{" "}
              <strong className="text-gray-700">{trip.tripType}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RouteRow({
  label,
  address,
  color,
}: {
  label: string;
  address: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${color}`} />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xs text-gray-700">{address}</p>
      </div>
    </div>
  );
}
