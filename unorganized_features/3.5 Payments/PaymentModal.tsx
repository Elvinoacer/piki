"use client";
// components/payments/PaymentModal.tsx
// Client-facing payment modal shown after a trip completes
// Supports: M-Pesa STK, Wallet, Cash acknowledgement

import { useState } from "react";
import { useWalletStore } from "@/store/walletStore";

interface PaymentModalProps {
  tripId: string;
  fareAmount: number;
  onSuccess: (method: string) => void;
  onClose: () => void;
}

type PayMethod = "MPESA" | "WALLET" | "CASH";

export function PaymentModal({
  tripId,
  fareAmount,
  onSuccess,
  onClose,
}: PaymentModalProps) {
  const [method, setMethod] = useState<PayMethod>("MPESA");
  const [phone, setPhone] = useState("");
  const [tip, setTip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingStk, setAwaitingStk] = useState(false);

  const { balance, payFromWallet } = useWalletStore();

  const total = fareAmount + tip;
  const walletBalance = balance?.balance ?? 0;
  const walletInsufficient = method === "WALLET" && walletBalance < total;

  async function handlePay() {
    setError(null);
    setLoading(true);

    try {
      if (method === "MPESA") {
        const res = await fetch("/api/payments/mpesa/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, phone, tipAmount: tip }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "M-Pesa initiation failed");
        setAwaitingStk(true);
        // Poll for completion or wait for push notification
        pollStkStatus(data.checkoutRequestId);
      } else if (method === "WALLET") {
        const success = await payFromWallet(tripId, tip);
        if (success) onSuccess("WALLET");
        else throw new Error("Wallet payment failed");
      } else {
        // CASH — client acknowledges, rider confirms on their end
        onSuccess("CASH");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      if (!awaitingStk) setLoading(false);
    }
  }

  async function pollStkStatus(checkoutRequestId: string) {
    // Poll every 5s for up to 60s
    const maxAttempts = 12;
    let attempt = 0;
    const interval = setInterval(async () => {
      attempt++;
      try {
        const res = await fetch(
          `/api/payments/mpesa/status?checkoutRequestId=${checkoutRequestId}`
        );
        const data = await res.json();
        if (data.status === "COMPLETED") {
          clearInterval(interval);
          setLoading(false);
          setAwaitingStk(false);
          onSuccess("MPESA");
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          setLoading(false);
          setAwaitingStk(false);
          setError(data.reason ?? "M-Pesa payment failed. Please retry.");
        }
      } catch {
        // polling error — keep trying
      }
      if (attempt >= maxAttempts) {
        clearInterval(interval);
        setLoading(false);
        setAwaitingStk(false);
        setError("Payment timed out. Check your M-Pesa or try again.");
      }
    }, 5000);
  }

  const tipOptions = [0, 20, 50, 100];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-md rounded-t-2xl bg-white px-6 py-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Pay for Your Ride</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Fare Summary */}
        <div className="mb-6 rounded-xl bg-gray-50 p-4">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Fare</span>
            <span>KES {fareAmount.toFixed(2)}</span>
          </div>
          {tip > 0 && (
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Tip</span>
              <span>KES {tip.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
            <span>Total</span>
            <span>KES {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Tip selection */}
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">Add a tip?</p>
          <div className="flex gap-2">
            {tipOptions.map((t) => (
              <button
                key={t}
                onClick={() => setTip(t)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                  tip === t
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                }`}
              >
                {t === 0 ? "None" : `+${t}`}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Payment method</p>
          <div className="flex gap-2">
            {(["MPESA", "WALLET", "CASH"] as PayMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border py-3 text-sm font-semibold transition-colors ${
                  method === m
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                }`}
              >
                {m === "MPESA" ? "M-Pesa" : m === "WALLET" ? "Wallet" : "Cash"}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet balance indicator */}
        {method === "WALLET" && (
          <div className={`mb-4 rounded-lg p-3 text-sm ${walletInsufficient ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {walletInsufficient
              ? `Insufficient balance. You have KES ${walletBalance.toFixed(2)}.`
              : `Wallet balance: KES ${walletBalance.toFixed(2)}`}
          </div>
        )}

        {/* M-Pesa phone input */}
        {method === "MPESA" && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              M-Pesa number
            </label>
            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500">
              <span className="bg-gray-50 px-3 py-3 text-sm text-gray-500 border-r border-gray-300">+254</span>
              <input
                type="tel"
                placeholder="7XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-3 py-3 text-sm outline-none"
                maxLength={9}
              />
            </div>
          </div>
        )}

        {/* Cash info */}
        {method === "CASH" && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Pay <strong>KES {fareAmount.toFixed(0)}</strong> cash directly to your rider. Your rider will confirm receipt.
          </div>
        )}

        {/* STK awaiting */}
        {awaitingStk && (
          <div className="mb-4 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800 text-center">
            📱 Check your phone and enter your M-Pesa PIN to complete payment…
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={handlePay}
          disabled={loading || (method === "WALLET" && walletInsufficient) || (method === "MPESA" && !phone)}
          className="w-full rounded-xl bg-indigo-600 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? awaitingStk
              ? "Waiting for M-Pesa…"
              : "Processing…"
            : method === "CASH"
            ? "Confirm Cash Payment"
            : `Pay KES ${total.toFixed(0)}`}
        </button>
      </div>
    </div>
  );
}
