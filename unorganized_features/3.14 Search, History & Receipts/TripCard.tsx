// components/history/TripCard.tsx
// Feature 3.14 — Search, History & Receipts
"use client";

import { useState } from "react";
import Image from "next/image";
import { useHistoryStore } from "@/store/history-store";
import type { TripHistoryItem } from "@/types/history";

interface TripCardProps {
  trip: TripHistoryItem;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  COMPLETED:   { bg: "bg-green-50",  text: "text-green-700",  label: "Completed" },
  CANCELLED:   { bg: "bg-red-50",    text: "text-red-700",    label: "Cancelled" },
  IN_PROGRESS: { bg: "bg-blue-50",   text: "text-blue-700",   label: "In Progress" },
  ARRIVING:    { bg: "bg-yellow-50", text: "text-yellow-700", label: "Rider Arriving" },
  ACCEPTED:    { bg: "bg-yellow-50", text: "text-yellow-700", label: "Accepted" },
  REQUESTED:   { bg: "bg-gray-50",   text: "text-gray-700",   label: "Requested" },
  ARRIVED:     { bg: "bg-yellow-50", text: "text-yellow-700", label: "Rider Arrived" },
};

const TRIP_TYPE_LABELS: Record<string, string> = {
  RIDE:   "Boda Ride",
  PARCEL: "Parcel Delivery",
  FOOD:   "Food/Errand",
  ERRAND: "Errand",
};

const TRIP_TYPE_ICONS: Record<string, string> = {
  RIDE:   "🏍️",
  PARCEL: "📦",
  FOOD:   "🍱",
  ERRAND: "🛒",
};

export function TripCard({ trip }: TripCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { receiptState, fetchReceiptUrl, generateReceipt } = useHistoryStore();

  const receipt = receiptState[trip.id];
  const status = STATUS_STYLES[trip.status] ?? STATUS_STYLES.REQUESTED;
  const canDownloadReceipt = ["COMPLETED", "CANCELLED"].includes(trip.status);

  const formattedDate = new Date(trip.createdAt).toLocaleDateString("en-KE", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleReceiptClick = async () => {
    if (receipt?.url) {
      // Already fetched — open directly
      window.open(receipt.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (trip.receiptUrl) {
      // Receipt exists in DB — get signed URL
      await fetchReceiptUrl(trip.id);
      const updated = useHistoryStore.getState().receiptState[trip.id];
      if (updated?.url) window.open(updated.url, "_blank", "noopener,noreferrer");
    } else {
      // Need to generate
      await generateReceipt(trip.id);
      const updated = useHistoryStore.getState().receiptState[trip.id];
      if (updated?.url) window.open(updated.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Main row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: icon + addresses */}
          <div className="flex gap-3 flex-1 min-w-0">
            <span className="text-2xl flex-shrink-0 mt-0.5">{TRIP_TYPE_ICONS[trip.type] ?? "🏍️"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {TRIP_TYPE_LABELS[trip.type]}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1 truncate">
                <span className="text-green-500 mr-1">●</span>
                {trip.pickupAddress}
              </p>
              <p className="text-sm text-gray-700 mt-0.5 truncate">
                <span className="text-red-500 mr-1">●</span>
                {trip.dropoffAddress}
              </p>
              <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
            </div>
          </div>

          {/* Right: fare + expand */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {trip.fareAmount != null && (
              <span className="text-base font-semibold text-gray-900">
                KES {trip.fareAmount.toFixed(0)}
              </span>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
              aria-label={expanded ? "Show less" : "Show more"}
            >
              {expanded ? "Less ▲" : "Details ▼"}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 pt-3 pb-4 space-y-3 bg-gray-50/50">
          {/* Trip meta */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {trip.distanceKm != null && (
              <>
                <span className="text-gray-500">Distance</span>
                <span className="text-gray-800">{trip.distanceKm.toFixed(1)} km</span>
              </>
            )}
            {trip.durationMin != null && (
              <>
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-800">{trip.durationMin} min</span>
              </>
            )}
            {trip.paymentMethod && (
              <>
                <span className="text-gray-500">Payment</span>
                <span className="text-gray-800">
                  {{ MPESA: "M-Pesa", WALLET: "Pikii Wallet", CASH: "Cash" }[trip.paymentMethod] ?? trip.paymentMethod}
                </span>
              </>
            )}
            {trip.cancelReason && (
              <>
                <span className="text-gray-500">Cancel reason</span>
                <span className="text-gray-800">{trip.cancelReason}</span>
              </>
            )}
          </div>

          {/* Fare breakdown */}
          {trip.fareBreakdown && (
            <div className="bg-white rounded-xl p-3 text-sm space-y-1 border border-gray-100">
              <p className="font-medium text-gray-700 text-xs uppercase tracking-wide mb-2">Fare Breakdown</p>
              <Row label="Base fare" value={`KES ${trip.fareBreakdown.baseFare.toFixed(2)}`} />
              <Row label="Distance" value={`KES ${trip.fareBreakdown.distanceFare.toFixed(2)}`} />
              <Row label="Time" value={`KES ${trip.fareBreakdown.timeFare.toFixed(2)}`} />
              {trip.fareBreakdown.surgeFactor > 1 && (
                <Row label={`Surge ×${trip.fareBreakdown.surgeFactor.toFixed(1)}`} value="—" />
              )}
              {trip.fareBreakdown.tip > 0 && (
                <Row label="Tip" value={`KES ${trip.fareBreakdown.tip.toFixed(2)}`} />
              )}
              <div className="pt-1 border-t border-gray-100 flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span>KES {trip.fareBreakdown.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Rider info */}
          {trip.rider && (
            <div className="flex items-center gap-3">
              {trip.rider.avatarUrl ? (
                <Image
                  src={trip.rider.avatarUrl}
                  alt={trip.rider.name}
                  width={36}
                  height={36}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                  {trip.rider.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-800">{trip.rider.name}</p>
                <p className="text-xs text-gray-500">
                  {trip.rider.plateNumber ?? ""}
                  {trip.rider.rating != null && ` · ⭐ ${trip.rider.rating.toFixed(1)}`}
                </p>
              </div>
            </div>
          )}

          {/* Your rating */}
          {trip.rating && (
            <div className="text-sm">
              <span className="text-gray-500">Your rating: </span>
              <span className="text-yellow-500">
                {"★".repeat(trip.rating.score)}{"☆".repeat(5 - trip.rating.score)}
              </span>
              {trip.rating.comment && (
                <p className="text-gray-600 text-xs mt-0.5 italic">"{trip.rating.comment}"</p>
              )}
            </div>
          )}

          {/* Receipt button */}
          {canDownloadReceipt && (
            <div className="pt-1">
              <button
                onClick={handleReceiptClick}
                disabled={receipt?.loading}
                className="
                  inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                  rounded-xl bg-blue-600 text-white hover:bg-blue-700
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {receipt?.loading ? (
                  <>
                    <Spinner />
                    {trip.receiptUrl ? "Loading…" : "Generating…"}
                  </>
                ) : (
                  <>
                    <DownloadIcon />
                    {trip.receiptUrl ? "Download Receipt" : "Generate Receipt"}
                  </>
                )}
              </button>
              {receipt?.error && (
                <p className="text-xs text-red-600 mt-1">{receipt.error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-gray-700">
      <span className="text-gray-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M12 12v6m0 0l-3-3m3 3l3-3M12 4v8" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
