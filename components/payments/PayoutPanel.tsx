"use client";
// components/payments/PayoutPanel.tsx
// Rider-facing payout panel: request withdrawal, view payout history

import { useEffect, useState } from "react";
import { useWalletStore } from "@/store/walletStore";

const MIN_PAYOUT = 100;

interface PayoutHistory {
  id: string;
  amount: number;
  status: string;
  mpesaPhone: string;
  mpesaReceiptNumber?: string;
  failureReason?: string;
  processedAt?: string;
  createdAt: string;
}

export function PayoutPanel() {
  const { balance, fetchBalance, requestPayout, payoutLoading, error } = useWalletStore();

  const [payouts, setPayouts] = useState<PayoutHistory[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
    loadPayouts();
  }, []);

  async function loadPayouts() {
    setLoadingPayouts(true);
    try {
      const res = await fetch("/api/payments/payout");
      const data = await res.json();
      if (res.ok) setPayouts(data.payouts);
    } finally {
      setLoadingPayouts(false);
    }
  }

  async function handlePayout() {
    const amt = parseFloat(amount);
    if (!amt || amt < MIN_PAYOUT) return;
    const result = await requestPayout(amt, phone || undefined);
    if (result?.message) {
      setSuccessMsg(result.message);
      setAmount("");
      setPhone("");
      await loadPayouts();
    }
  }

  const walletBalance = balance?.balance ?? 0;
  const canPayout = walletBalance >= MIN_PAYOUT;

  return (
    <div className="space-y-6">
      {/* Balance Summary */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-emerald-100">Available to Withdraw</p>
        <p className="mt-1 text-3xl font-bold">
          KES {walletBalance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
        </p>
        {!canPayout && (
          <p className="mt-1 text-xs text-emerald-200">
            Minimum withdrawal is KES {MIN_PAYOUT}
          </p>
        )}
      </div>

      {/* Withdrawal Form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-900">Withdraw to M-Pesa</h3>

        {!canPayout ? (
          <p className="text-sm text-gray-500">
            Earn at least KES {MIN_PAYOUT} to withdraw.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Amount (KES)
              </label>
              <div className="flex gap-2 mb-2">
                {[200, 500, 1000, Math.floor(walletBalance)].map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a.toString())}
                    className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                      amount === a.toString()
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-gray-200 text-gray-700 hover:border-emerald-300"
                    }`}
                  >
                    {a === Math.floor(walletBalance) ? "All" : a}
                  </button>
                ))}
              </div>
              <input
                type="number"
                placeholder={`Min KES ${MIN_PAYOUT}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                min={MIN_PAYOUT}
                max={walletBalance}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                M-Pesa Number (leave blank to use registered number)
              </label>
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-500 border-r border-gray-300">+254</span>
                <input
                  type="tel"
                  placeholder="7XXXXXXXX (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm outline-none"
                  maxLength={9}
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {successMsg && (
              <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                {successMsg}
              </p>
            )}

            <button
              onClick={handlePayout}
              disabled={
                payoutLoading ||
                !amount ||
                parseFloat(amount) < MIN_PAYOUT ||
                parseFloat(amount) > walletBalance
              }
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {payoutLoading
                ? "Initiating payout…"
                : `Withdraw KES ${amount || "0"}`}
            </button>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div>
        <h3 className="mb-3 font-semibold text-gray-900">Payout History</h3>
        {loadingPayouts ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <div className="rounded-xl bg-gray-50 py-8 text-center text-sm text-gray-500">
            No payouts yet
          </div>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                    <span className="text-xs text-gray-500">{p.mpesaPhone}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(p.createdAt)}
                    {p.mpesaReceiptNumber && ` · ${p.mpesaReceiptNumber}`}
                  </p>
                  {p.failureReason && (
                    <p className="text-xs text-red-600">{p.failureReason}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900">
                  KES {p.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };
  return map[status] ?? "bg-gray-100 text-gray-800";
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(date));
}
