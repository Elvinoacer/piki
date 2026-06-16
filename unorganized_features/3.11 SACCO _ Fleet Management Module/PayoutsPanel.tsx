// src/components/sacco/PayoutsPanel.tsx
"use client";

import { useState, useTransition } from "react";
import type {
  SaccoPayoutBatchDTO,
  RiderPayoutDTO,
  PayoutManager,
} from "@/types/sacco";
import { initiatePayoutBatch } from "@/lib/sacco/actions";
import { Wallet, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Props {
  batches: SaccoPayoutBatchDTO[];
  pendingRiders: RiderPayoutDTO[];
  saccoId: string;
  payoutManagedBy: PayoutManager;
}

const BATCH_STATUS_STYLES: Record<SaccoPayoutBatchDTO["status"], { cls: string; icon: React.ReactNode }> = {
  PENDING: {
    cls: "bg-gray-100 text-gray-600",
    icon: <Clock size={12} />,
  },
  PROCESSING: {
    cls: "bg-amber-50 text-amber-700",
    icon: <Clock size={12} />,
  },
  COMPLETED: {
    cls: "bg-emerald-50 text-emerald-700",
    icon: <CheckCircle size={12} />,
  },
  FAILED: {
    cls: "bg-red-50 text-red-700",
    icon: <AlertCircle size={12} />,
  },
};

export default function PayoutsPanel({
  batches,
  pendingRiders,
  saccoId,
  payoutManagedBy,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  const totalSelected = pendingRiders
    .filter((r) => selected.has(r.riderId))
    .reduce((s, r) => s + Number(r.pendingEarnings), 0);

  function toggleRider(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleInitiatePayout() {
    if (selected.size === 0) return;
    startTransition(async () => {
      await initiatePayoutBatch(saccoId, {
        riderProfileIds: Array.from(selected),
        note: note || undefined,
      });
      setSelected(new Set());
      setNote("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    });
  }

  return (
    <div className="space-y-8">
      {/* SACCO-managed payout section */}
      {payoutManagedBy === "SACCO" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={16} className="text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-800">
                Pending Disbursements
              </h2>
            </div>
            {selected.size > 0 && (
              <p className="text-xs text-gray-500">
                KES {totalSelected.toLocaleString()} selected
              </p>
            )}
          </div>

          {success && (
            <div className="mx-6 mt-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">
              ✓ Payout batch queued. M-Pesa transfers will be sent shortly.
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {pendingRiders.map((rider) => (
              <label
                key={rider.riderId}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={selected.has(rider.riderId)}
                  onChange={() => toggleRider(rider.riderId)}
                  className="rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{rider.riderName}</p>
                  <p className="text-xs text-gray-400">{rider.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    KES {Number(rider.pendingEarnings).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400">
                    {rider.lastPayoutDate
                      ? `Last paid ${new Date(rider.lastPayoutDate).toLocaleDateString("en-KE")}`
                      : "Never paid"}
                  </p>
                </div>
              </label>
            ))}
            {pendingRiders.length === 0 && (
              <p className="px-6 py-10 text-sm text-gray-400 text-center">
                No pending balances to disburse.
              </p>
            )}
          </div>

          {pendingRiders.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-50 space-y-3">
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <div className="flex gap-3 items-center">
                <button
                  onClick={() =>
                    setSelected(new Set(pendingRiders.map((r) => r.riderId)))
                  }
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs text-gray-400 hover:underline"
                >
                  Clear
                </button>
                <div className="flex-1" />
                <button
                  disabled={selected.size === 0 || isPending}
                  onClick={handleInitiatePayout}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition disabled:opacity-40"
                >
                  {isPending
                    ? "Processing…"
                    : `Pay ${selected.size} rider${selected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Batch history */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-800">Payout History</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {batches.map((batch) => {
            const style = BATCH_STATUS_STYLES[batch.status];
            return (
              <div key={batch.id} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">
                      KES {Number(batch.totalAmount).toLocaleString()}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${style.cls}`}
                    >
                      {style.icon}
                      {batch.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {batch.payoutCount} riders ·{" "}
                    {new Date(batch.createdAt).toLocaleDateString("en-KE")}
                    {batch.note && ` · ${batch.note}`}
                  </p>
                  {batch.mpesaB2CRef && (
                    <p className="text-xs text-gray-400">
                      M-Pesa ref: {batch.mpesaB2CRef}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          {batches.length === 0 && (
            <p className="px-6 py-10 text-sm text-gray-400 text-center">
              No payout batches yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
