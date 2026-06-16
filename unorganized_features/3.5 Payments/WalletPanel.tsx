"use client";
// components/payments/WalletPanel.tsx
// In-app wallet: shows balance, top-up via M-Pesa, transaction history
// Used by both clients (top-up) and riders (earnings view + withdrawal)

import { useEffect, useState } from "react";
import { useWalletStore } from "@/store/walletStore";

interface WalletPanelProps {
  role: "CLIENT" | "RIDER";
}

export function WalletPanel({ role }: WalletPanelProps) {
  const {
    balance,
    ledger,
    ledgerPage,
    ledgerTotal,
    isLoadingBalance,
    isLoadingLedger,
    topUpLoading,
    error,
    fetchBalance,
    fetchLedger,
    topUp,
  } = useWalletStore();

  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpPhone, setTopUpPhone] = useState("");
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);

  useEffect(() => {
    fetchBalance();
    fetchLedger(1);
  }, []);

  async function handleTopUp() {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 10) return;

    const result = await topUp(amount, topUpPhone);
    if (result?.checkoutRequestId) {
      setTopUpSuccess(true);
      setShowTopUp(false);
      setTopUpAmount("");
    }
  }

  const pageSize = 20;
  const totalPages = Math.ceil(ledgerTotal / pageSize);

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10" />
        <p className="text-sm font-medium text-indigo-200">
          {role === "RIDER" ? "Earnings Balance" : "Wallet Balance"}
        </p>
        {isLoadingBalance ? (
          <div className="mt-2 h-10 w-32 animate-pulse rounded-lg bg-white/20" />
        ) : (
          <p className="mt-2 text-4xl font-bold tracking-tight">
            KES {(balance?.balance ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
        )}
        <p className="mt-1 text-xs text-indigo-300">
          {balance?.currency ?? "KES"} · Updated just now
        </p>

        {role === "CLIENT" && (
          <button
            onClick={() => setShowTopUp(!showTopUp)}
            className="mt-4 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            + Top Up
          </button>
        )}
      </div>

      {/* Top-up success */}
      {topUpSuccess && (
        <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
          ✓ Check your phone and enter your M-Pesa PIN to complete the top-up.
          <button
            className="ml-2 underline"
            onClick={() => setTopUpSuccess(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top-up form */}
      {showTopUp && role === "CLIENT" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">Top Up Wallet</h3>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Amount (KES)</label>
            <div className="flex gap-2 mb-2">
              {[100, 200, 500, 1000].map((a) => (
                <button
                  key={a}
                  onClick={() => setTopUpAmount(a.toString())}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    topUpAmount === a.toString()
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-gray-200 text-gray-700 hover:border-indigo-300"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Or enter amount"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              min={10}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">M-Pesa Number</label>
            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-500 border-r border-gray-300">+254</span>
              <input
                type="tel"
                placeholder="7XXXXXXXX"
                value={topUpPhone}
                onChange={(e) => setTopUpPhone(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm outline-none"
                maxLength={9}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={handleTopUp}
            disabled={topUpLoading || !topUpAmount || !topUpPhone}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {topUpLoading ? "Initiating…" : `Pay KES ${topUpAmount || "0"} via M-Pesa`}
          </button>
        </div>
      )}

      {/* Transaction Ledger */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Transactions</h3>
          <span className="text-xs text-gray-500">{ledgerTotal} total</span>
        </div>

        {isLoadingLedger ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : ledger.length === 0 ? (
          <div className="rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-500">
            No transactions yet
          </div>
        ) : (
          <div className="space-y-2">
            {ledger.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                      entry.type === "CREDIT"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {entry.type === "CREDIT" ? "+" : "−"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {formatReason(entry.reason)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(entry.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      entry.type === "CREDIT" ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {entry.type === "CREDIT" ? "+" : "−"}KES{" "}
                    {entry.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Bal: {entry.balanceAfter.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              onClick={() => fetchLedger(ledgerPage - 1)}
              disabled={ledgerPage <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              {ledgerPage} / {totalPages}
            </span>
            <button
              onClick={() => fetchLedger(ledgerPage + 1)}
              disabled={ledgerPage >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function formatReason(reason: string): string {
  const labels: Record<string, string> = {
    TOP_UP: "Wallet Top-up",
    TRIP_PAYMENT: "Trip Payment",
    TRIP_EARNING: "Trip Earnings",
    COMMISSION_DEDUCTION: "Platform Commission",
    PAYOUT: "M-Pesa Withdrawal",
    REFUND: "Refund",
    TIP_SENT: "Tip Sent",
    TIP_RECEIVED: "Tip Received",
    PROMO_CREDIT: "Promo Credit",
    ADJUSTMENT: "Adjustment",
  };
  return labels[reason] ?? reason;
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(date));
}
