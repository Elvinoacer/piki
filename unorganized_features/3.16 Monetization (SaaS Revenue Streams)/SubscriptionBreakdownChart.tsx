"use client";
// app/(dashboard)/admin/monetization/_components/SubscriptionBreakdownChart.tsx
// Simple visual breakdown of active subscription counts by role.

import type { MonetizationSummary } from "@/types/monetization";

interface Props {
  summary: MonetizationSummary;
}

export default function SubscriptionBreakdownChart({ summary }: Props) {
  const { rider, sacco, client } = summary.activeSubscriptions;
  const total = rider + sacco + client;

  const segments = [
    { label: "Rider (Pikii Pro)", count: rider, color: "bg-blue-500" },
    { label: "SACCO Plans", count: sacco, color: "bg-purple-500" },
    { label: "Client Plus", count: client, color: "bg-green-500" },
  ];

  if (total === 0) {
    return (
      <div className="rounded-xl border border-gray-200 p-6 text-sm text-gray-400">
        No active subscriptions yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-5 bg-white flex flex-col gap-4">
      {/* Progress bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              className={`${s.color} transition-all`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${s.color}`} />
            <span className="text-sm text-gray-600">{s.label}</span>
            <span className="text-sm font-semibold text-gray-900">{s.count}</span>
            <span className="text-xs text-gray-400">
              ({total > 0 ? Math.round((s.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-400">Total</span>
          <span className="text-sm font-bold text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  );
}
