"use client";
// app/(dashboard)/admin/monetization/_components/MonetizationSummaryCards.tsx

import type { MonetizationSummary } from "@/types/monetization";

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface Props {
  summary: MonetizationSummary;
}

export default function MonetizationSummaryCards({ summary }: Props) {
  const cards = [
    {
      label: "Total Revenue (MTD)",
      value: formatKes(summary.totalRevenueKes),
      sub: "All streams combined",
      color: "bg-green-50 border-green-200",
      valueColor: "text-green-700",
    },
    {
      label: "Commission Revenue",
      value: formatKes(summary.commissionRevenueKes),
      sub: "Trip commissions collected",
      color: "bg-blue-50 border-blue-200",
      valueColor: "text-blue-700",
    },
    {
      label: "Subscription Revenue",
      value: formatKes(summary.subscriptionRevenueKes),
      sub: "Rider Pro, SACCO & Client Plus",
      color: "bg-purple-50 border-purple-200",
      valueColor: "text-purple-700",
    },
    {
      label: "Ad Revenue (Spend)",
      value: formatKes(summary.adRevenueKes),
      sub: "Advertiser budget consumed",
      color: "bg-orange-50 border-orange-200",
      valueColor: "text-orange-700",
    },
    {
      label: "Active Campaigns",
      value: String(summary.activeCampaigns),
      sub: "Live ad placements",
      color: "bg-yellow-50 border-yellow-200",
      valueColor: "text-yellow-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border p-4 ${card.color}`}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {card.label}
          </p>
          <p className={`mt-2 text-xl font-bold ${card.valueColor}`}>
            {card.value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
