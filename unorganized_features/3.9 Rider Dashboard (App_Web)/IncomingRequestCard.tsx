"use client";
// components/rider/IncomingRequestCard.tsx
// Incoming ride request with countdown timer — PRD §3.9

import { useEffect, useRef } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { TripType } from "@/types/rider-dashboard";

const TRIP_TYPE_ICONS: Record<TripType, string> = {
  RIDE: "🏍️",
  PARCEL: "📦",
  ERRAND: "🛒",
  FOOD: "🍱",
};

const TRIP_TYPE_LABELS: Record<TripType, string> = {
  RIDE: "Passenger Ride",
  PARCEL: "Parcel Delivery",
  ERRAND: "Errand",
  FOOD: "Food Delivery",
};

export function IncomingRequestCard() {
  const { incomingRequest, countdownSeconds, acceptRequest, declineRequest, tickCountdown } =
    useRiderDashboardStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!incomingRequest) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(tickCountdown, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [incomingRequest?.id, tickCountdown]);

  if (!incomingRequest) return null;

  const req = incomingRequest;
  const totalSeconds = req.countdownSeconds;
  const pct = Math.max(0, (countdownSeconds / totalSeconds) * 100);
  const urgentColor = countdownSeconds <= 5 ? "text-red-600" : "text-gray-900";
  const progressColor =
    countdownSeconds <= 5
      ? "bg-red-500"
      : countdownSeconds <= 10
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 w-full">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {TRIP_TYPE_ICONS[req.tripType]}
              </span>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {TRIP_TYPE_LABELS[req.tripType]}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-amber-500 text-xs">★</span>
                  <span className="text-xs text-gray-600">
                    {req.clientRating.toFixed(1)} client
                  </span>
                </div>
              </div>
            </div>
            {/* Countdown */}
            <div className="text-right">
              <span className={`text-3xl font-bold tabular-nums ${urgentColor}`}>
                {countdownSeconds}
              </span>
              <p className="text-xs text-gray-400">sec</p>
            </div>
          </div>

          {/* Route */}
          <div className="flex flex-col gap-1.5 mb-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-sm text-gray-700 leading-snug">{req.pickupAddress}</p>
            </div>
            <div className="ml-[4.5px] w-px h-3 bg-gray-300 self-center" />
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-sm text-gray-700 leading-snug">{req.dropoffAddress}</p>
            </div>
          </div>

          {/* Meta: fare + distance */}
          <div className="flex items-center gap-4 mb-4 px-1">
            <div>
              <p className="text-xs text-gray-400">Estimated fare</p>
              <p className="text-base font-bold text-gray-900">
                KES {req.estimatedFare.toLocaleString()}
              </p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div>
              <p className="text-xs text-gray-400">Distance</p>
              <p className="text-base font-bold text-gray-900">
                {req.estimatedDistance.toFixed(1)} km
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => declineRequest(req.id)}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm active:scale-95 transition-transform"
            >
              Decline
            </button>
            <button
              onClick={() => acceptRequest(req.id)}
              className="flex-[2] py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm active:scale-95 transition-transform shadow-md shadow-emerald-200"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
