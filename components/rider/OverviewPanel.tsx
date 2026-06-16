"use client";
// components/rider/OverviewPanel.tsx
// Dashboard overview — quick-glance metrics + active trip card — PRD §3.9

import { useRiderDashboardStore } from "@/store/riderDashboardStore";

export function OverviewPanel() {
  const { rider, earnings, performance, wallet, activeTrip } =
    useRiderDashboardStore();

  return (
    <div className="flex flex-col gap-4">
      {/* Active trip banner */}
      {activeTrip && (
        <div className="bg-blue-600 text-white rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">🏍️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-blue-200 uppercase tracking-wide">
              Active Trip
            </p>
            <p className="text-sm font-semibold mt-0.5 truncate">
              {activeTrip.clientName} → {activeTrip.dropoffAddress}
            </p>
            <p className="text-xs text-blue-300 capitalize mt-0.5">
              {activeTrip.status.replace("_", " ").toLowerCase()}
            </p>
          </div>
          <p className="text-sm font-bold shrink-0">
            KES {activeTrip.fare.toLocaleString()}
          </p>
        </div>
      )}

      {/* Today earnings card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-emerald-600">Today</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">
            KES {earnings?.today.toLocaleString() ?? "—"}
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
          <p className="text-xs font-medium text-indigo-600">Wallet</p>
          <p className="text-2xl font-bold text-indigo-800 mt-1">
            KES {wallet?.available.toLocaleString() ?? "—"}
          </p>
        </div>
      </div>

      {/* Quick stats row */}
      {performance && (
        <div className="grid grid-cols-3 gap-2">
          <QuickStat
            label="Rating"
            value={`${performance.averageRating.toFixed(1)} ★`}
            sub="average"
          />
          <QuickStat
            label="Acceptance"
            value={`${performance.acceptanceRate}%`}
            sub="rate"
          />
          <QuickStat
            label="Trips"
            value={performance.totalTrips.toLocaleString()}
            sub="lifetime"
          />
        </div>
      )}

      {/* Rider identity card */}
      {rider && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-base shrink-0">
            {rider.avatarUrl ? (
              <img
                src={rider.avatarUrl}
                alt={rider.name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              rider.name[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {rider.name}
            </p>
            <p className="text-xs text-gray-500">{rider.plateNumber}</p>
            {rider.saccoName && (
              <p className="text-xs text-gray-400">{rider.saccoName}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {rider.badges.map((b) => (
              <span
                key={b}
                className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-base font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-600 mt-0.5">{label}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
