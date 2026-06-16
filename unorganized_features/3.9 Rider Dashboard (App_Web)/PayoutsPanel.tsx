"use client";
// components/rider/PayoutsPanel.tsx
// Wallet balance + payout request + history — PRD §3.9

import { useState } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { PayoutRequest, PayoutStatus } from "@/types/rider-dashboard";

const STATUS_CONFIG: Record<
  PayoutStatus,
  { label: string; className: string }
> = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700" },
  PROCESSING: { label: "Processing", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Paid", className: "bg-emerald-100 text-emerald-700" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-600" },
};

export function PayoutsPanel() {
  const { wallet, payouts, requestPayout, isLoading, rider } =
    useRiderDashboardStore();

  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState(rider?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      setError("Minimum withdrawal is KES 100");
      return;
    }
    if (!phone.match(/^(?:\+254|0)[17]\d{8}$/)) {
      setError("Enter a valid Kenyan M-Pesa number");
      return;
    }
    try {
      await requestPayout(numAmount, phone);
      setAmount("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Wallet balance card */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <p className="text-sm font-medium text-indigo-200">Wallet Balance</p>
        <p className="text-4xl font-bold mt-1">
          KES {wallet?.available.toLocaleString() ?? "—"}
        </p>
        {(wallet?.pending ?? 0) > 0 && (
          <p className="mt-2 text-xs text-indigo-300">
            KES {wallet!.pending.toLocaleString()} processing
          </p>
        )}
      </div>

      {/* Request payout */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          Withdraw to M-Pesa
        </h3>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Amount (KES)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              min={100}
              max={wallet?.available ?? 0}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              M-Pesa Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712345678"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              ✓ Withdrawal requested! You'll receive an M-Pesa prompt shortly.
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isLoading || !wallet?.available}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
          >
            {isLoading ? "Requesting…" : "Withdraw"}
          </button>
        </div>
      </div>

      {/* Payout history */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Payout History
        </h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No withdrawals yet
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payouts.map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PayoutRow({ payout }: { payout: PayoutRequest }) {
  const cfg = STATUS_CONFIG[payout.status];
  const date = new Date(payout.requestedAt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });

  return (
    <li className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-gray-800">
          KES {payout.amount.toLocaleString()}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{date}</span>
          {payout.mpesaRef && (
            <span className="text-xs text-gray-400">· {payout.mpesaRef}</span>
          )}
        </div>
      </div>
      <span
        className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.className}`}
      >
        {cfg.label}
      </span>
    </li>
  );
}
