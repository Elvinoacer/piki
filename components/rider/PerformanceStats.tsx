"use client";
// components/rider/PerformanceStats.tsx
// Rider performance stats — PRD §3.9

import { useRiderDashboardStore } from "@/store/riderDashboardStore";

function StatRing({
  value,
  max = 100,
  label,
  color,
  suffix = "%",
}: {
  value: number;
  max?: number;
  label: string;
  color: string;
  suffix?: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth="8"
          />
          {/* Progress */}
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-800">
            {value}
            {suffix}
          </span>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-500 text-center">{label}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string;
  icon: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export function PerformanceStats() {
  const { performance } = useRiderDashboardStore();

  if (!performance) {
    return <StatsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Radial stats */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-5">
          Rate Metrics
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <StatRing
            value={performance.acceptanceRate}
            label="Acceptance Rate"
            color="#10b981"
          />
          <StatRing
            value={performance.completionRate}
            label="Completion Rate"
            color="#6366f1"
          />
          <StatRing
            value={parseFloat((performance.averageRating * 20).toFixed(0))}
            label="Avg Rating"
            color="#f59e0b"
            suffix={`★`}
          />
        </div>
      </div>

      {/* Grid stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Trips"
          value={performance.totalTrips.toLocaleString()}
          icon="🏍️"
        />
        <StatCard
          label="Distance Covered"
          value={`${performance.totalDistanceKm.toLocaleString()} km`}
          icon="📍"
        />
        <StatCard
          label="All-time Earnings"
          value={`KES ${performance.totalEarningsAllTime.toLocaleString()}`}
          icon="💰"
          sub="After commission"
        />
        <StatCard
          label="Your Rating"
          value={`${performance.averageRating.toFixed(1)} ★`}
          icon="⭐"
          sub={performance.averageRating >= 4.7 ? "Top Rated" : "Keep it up!"}
        />
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-44 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
