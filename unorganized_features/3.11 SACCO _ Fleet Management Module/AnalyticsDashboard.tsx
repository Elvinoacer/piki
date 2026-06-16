// src/components/sacco/AnalyticsDashboard.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { FleetAnalyticsDTO } from "@/types/sacco";
import {
  Users,
  Wifi,
  CheckCircle,
  DollarSign,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface Props {
  data: FleetAnalyticsDTO;
  saccoId: string;
  activePeriod: "today" | "week" | "month";
}

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
] as const;

export default function AnalyticsDashboard({ data, saccoId, activePeriod }: Props) {
  const router = useRouter();

  function setPeriod(p: string) {
    router.push(`/sacco/${saccoId}/analytics?period=${p}`);
  }

  const stats = [
    {
      label: "Active Riders",
      value: data.activeRiders,
      sub: `${data.onlineNow} online now`,
      icon: Users,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Trips Completed",
      value: data.tripsCompleted,
      sub: "completed rides",
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Total Revenue",
      value: `KES ${Number(data.totalRevenue).toLocaleString()}`,
      sub: `SACCO earned KES ${Number(data.totalCommissionEarned).toLocaleString()}`,
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Docs Expiring",
      value: data.documentsExpiringSoon,
      sub: `${data.documentsExpired} already expired`,
      icon: AlertTriangle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              activePeriod === p.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
          >
            <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-4`}>
              <s.icon size={18} className={s.color} strokeWidth={2} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{s.label}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Top performers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
          <TrendingUp size={16} className="text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Top Performers</h2>
        </div>
        {data.topPerformers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No trips completed in this period.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {data.topPerformers.map((p, i) => (
              <li
                key={p.riderProfileId}
                className="flex items-center gap-4 px-6 py-4"
              >
                <span className="text-xs font-bold text-gray-300 w-5">
                  {i + 1}
                </span>
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt={p.riderName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-indigo-600">
                      {p.riderName[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {p.riderName}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.tripsCompleted} trips · ⭐ {p.rating}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900">
                    KES {Number(p.earnings).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
