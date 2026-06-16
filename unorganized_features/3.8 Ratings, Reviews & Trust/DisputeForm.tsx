"use client";
// src/components/ratings/DisputeForm.tsx
// Inline form for raising a dispute tied to a specific trip.

import { useState } from "react";
import { useRatingsStore } from "@/store/useRatingsStore";
import type { DisputeReason } from "@/types/ratings";

const DISPUTE_REASONS: { value: DisputeReason; label: string }[] = [
  { value: "WRONG_FARE", label: "Wrong fare charged" },
  { value: "RIDER_DID_NOT_ARRIVE", label: "Rider did not arrive" },
  { value: "UNSAFE_DRIVING", label: "Unsafe or reckless driving" },
  { value: "HARASSMENT", label: "Harassment or misconduct" },
  { value: "ITEM_DAMAGED_OR_LOST", label: "Item damaged or lost" },
  { value: "ROUTE_DEVIATION", label: "Route deviation" },
  { value: "PAYMENT_ISSUE", label: "Payment not processed correctly" },
  { value: "OTHER", label: "Other" },
];

interface DisputeFormProps {
  tripId: string;
  ratingId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DisputeForm({
  tripId,
  ratingId,
  onSuccess,
  onCancel,
}: DisputeFormProps) {
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");

  const { submitDispute, isSubmittingDispute, disputeError, clearDisputeError } =
    useRatingsStore();

  const handleSubmit = async () => {
    if (!reason || !description.trim()) return;
    clearDisputeError();

    const result = await submitDispute({
      tripId,
      ratingId,
      reason: reason as DisputeReason,
      description,
    });

    if (result) onSuccess?.();
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          Report an issue
        </h3>
        <p className="text-sm text-neutral-500 mt-0.5">
          Our support team will review and respond within 24 hours.
        </p>
      </div>

      {/* Reason picker */}
      <div>
        <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          What went wrong?
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DISPUTE_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                clearDisputeError();
                setReason(r.value);
              }}
              className={`text-left rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                reason === r.value
                  ? "border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="dispute-desc"
          className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2"
        >
          Describe what happened
        </label>
        <textarea
          id="dispute-desc"
          value={description}
          onChange={(e) => {
            clearDisputeError();
            setDescription(e.target.value);
          }}
          placeholder="Please provide as much detail as possible…"
          rows={4}
          maxLength={1000}
          className="w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-3 text-sm text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <p className="text-xs text-neutral-400 mt-1 text-right">
          {description.length}/1000
        </p>
      </div>

      {/* Error */}
      {disputeError && (
        <p className="text-sm text-red-600 dark:text-red-400">{disputeError}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-700 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!reason || !description.trim() || isSubmittingDispute}
          className="flex-[2] rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmittingDispute ? "Submitting…" : "Submit Dispute"}
        </button>
      </div>
    </div>
  );
}
