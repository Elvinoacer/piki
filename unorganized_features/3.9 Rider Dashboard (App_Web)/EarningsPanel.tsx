"use client";
// components/rider/EarningsPanel.tsx
// Earnings summary: today / week / month + per-trip breakdown — PRD §3.9

import { useState } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { TripEarning } from "@/types/rider-dashboard";

type Period = "today" | "thisWeek" | "thisMonth";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  thisWeek: "This Week",
  thisMonth: "This Month",
};

export function EarningsPanel() {
  const { earnings } = useRiderDashboardStore();
  const [period, setPeriod] = useState<Period>("today");

  if (!earnings) {
    return <EarningsSkeleton />;
  }

  const summaryValue =
    period === "today"
      ? earnings.today
      : period === "thisWeek"
      ? earnings.thisWeek
      : earnings.thisMonth;

  // Filter trips to the selected period
  const now = new Date();
  const periodTrips = earnings.trips.filter((t) => {
    const date = new Date(t.completedAt);
    if (period === "today") {
      return date.toDateString() === now.toDateString();
    }
    if (period === "thisWeek") {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - now.getDay());
      weekAgo.setHours(0, 0, 0, 0);
      return date >= weekAgo;
    }
    return true; // month is already filtered server-side
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Period selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`
              flex-1 py-2 text-xs font-semibold rounded-lg transition-all
              ${period === p
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-sm font-medium text-emerald-100 mb-1">
          {PERIOD_LABELS[period]} Earnings
        </p>
        <p className="text-4xl font-bold">
          KES {summaryValue.toLocaleString("en-KE", { minimumFractionDigits: 0 })}
        </p>
        {earnings.pendingPayout > 0 && (
          <p className="mt-2 text-xs text-emerald-200">
            KES {earnings.pendingPayout.toLocaleString()} pending payout
          </p>
        )}
      </div>

      {/* Trip breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Trips ({periodTrips.length})
        </h3>
        {periodTrips.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No trips in this period
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {periodTrips.map((t) => (
              <TripEarningRow key={t.tripId} trip={t} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TripEarningRow({ trip }: { trip: TripEarning }) {
  const time = new Date(trip.completedAt).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-medium text-gray-500 uppercase">
            {trip.tripType}
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <p className="text-sm text-gray-700 truncate">{trip.dropoffAddress}</p>
        {trip.clientRating !== null && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-amber-400 text-xs">★</span>
            <span className="text-xs text-gray-500">{trip.clientRating}</span>
          </div>
        )}
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="text-sm font-bold text-gray-900">
          +KES {trip.net.toLocaleString()}
        </p>
        <p className="text-xs text-gray-400">
          -{trip.commission.toLocaleString()} fee
        </p>
      </div>
    </li>
  );
}

function EarningsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-28 bg-gray-200 rounded-2xl" />
      <div className="flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
