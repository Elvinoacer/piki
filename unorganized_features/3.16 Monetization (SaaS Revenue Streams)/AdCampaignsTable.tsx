"use client";
// app/(dashboard)/admin/monetization/_components/AdCampaignsTable.tsx

import { useState } from "react";
import type { AdCampaign } from "@/types/monetization";

const STATUS_STYLE: Record<string, string> = {
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-gray-100 text-gray-600",
  REJECTED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  BUDGET_EXHAUSTED: "bg-orange-100 text-orange-700",
};

interface Props {
  campaigns: AdCampaign[];
}

export default function AdCampaignsTable({ campaigns }: Props) {
  const [filter, setFilter] = useState<string>("ALL");

  const statuses = ["ALL", "ACTIVE", "PENDING_REVIEW", "PAUSED", "COMPLETED", "BUDGET_EXHAUSTED", "REJECTED"];

  const visible =
    filter === "ALL" ? campaigns : campaigns.filter((c) => c.status === filter);

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No ad campaigns yet. Businesses can submit campaigns through the advertiser portal.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full text-sm divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {[
                "Advertiser",
                "Title",
                "Placement",
                "Audience",
                "Budget",
                "Spent",
                "Impressions",
                "Clicks",
                "CTR",
                "Status",
                "Ends",
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visible.map((c) => {
              const ctr =
                c.impressions > 0
                  ? ((c.clicks / c.impressions) * 100).toFixed(2)
                  : "—";
              const budgetPct =
                c.budgetKes > 0
                  ? Math.round((c.spentKes / c.budgetKes) * 100)
                  : 0;

              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {c.advertiserName}
                  </td>
                  <td className="px-3 py-3 text-gray-700 max-w-[160px] truncate">
                    {c.title}
                  </td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                    {c.placement.replace("_", " ")}
                  </td>
                  <td className="px-3 py-3 text-gray-500">{c.targetAudience}</td>
                  <td className="px-3 py-3 font-mono text-gray-700 whitespace-nowrap">
                    KES {c.budgetKes.toLocaleString("en-KE")}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-700">
                        KES {c.spentKes.toLocaleString("en-KE")}
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full"
                          style={{ width: `${Math.min(budgetPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{budgetPct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-gray-600">
                    {c.impressions.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 font-mono text-gray-600">
                    {c.clicks.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 font-mono text-gray-600">
                    {ctr === "—" ? "—" : `${ctr}%`}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(c.endsAt).toLocaleDateString("en-KE")}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-6 text-center text-sm text-gray-400"
                >
                  No campaigns match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
