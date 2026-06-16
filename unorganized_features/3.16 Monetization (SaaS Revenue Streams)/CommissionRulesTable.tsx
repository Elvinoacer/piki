"use client";
// app/(dashboard)/admin/monetization/_components/CommissionRulesTable.tsx

import type { CommissionRule } from "@/types/monetization";

const SCOPE_BADGE: Record<string, string> = {
  PLATFORM: "bg-gray-100 text-gray-600",
  SACCO: "bg-blue-100 text-blue-700",
  SUBSCRIPTION: "bg-purple-100 text-purple-700",
};

interface Props {
  rules: CommissionRule[];
}

export default function CommissionRulesTable({ rules }: Props) {
  if (rules.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">
        No commission rules found. Add a PLATFORM default rule to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Name", "Scope", "Rate", "Cap (KES)", "Floor (KES)", "Valid From", "Valid To"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rules.map((rule) => (
            <tr key={rule.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-800">{rule.name}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    SCOPE_BADGE[rule.scope] ?? "bg-gray-100 text-gray-500"
                  }`}
                >
                  {rule.scope}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-gray-700">
                {rule.ratePercent}%
              </td>
              <td className="px-4 py-3 text-gray-500">
                {rule.capKes != null ? `KES ${rule.capKes.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {rule.floorKes != null ? `KES ${rule.floorKes.toFixed(2)}` : "—"}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(rule.validFrom).toLocaleDateString("en-KE")}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {rule.validTo
                  ? new Date(rule.validTo).toLocaleDateString("en-KE")
                  : "No expiry"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
