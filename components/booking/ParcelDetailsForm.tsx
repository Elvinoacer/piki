"use client";

// ============================================================
// src/components/booking/ParcelDetailsForm.tsx
// Pikii — Parcel/Errand delivery metadata form
// ============================================================

import { useTripStore, selectParcelMeta } from "@/stores/useTripStore";

// ─────────────────────────────────────────────
// Parcel size options
// ─────────────────────────────────────────────

const SIZE_OPTIONS = [
  {
    value: "SMALL" as const,
    label: "Small",
    swahili: "Ndogo",
    description: "Documents, envelopes, phone",
    icon: "✉️",
  },
  {
    value: "MEDIUM" as const,
    label: "Medium",
    swahili: "Wastani",
    description: "Grocery bag, small box",
    icon: "🛍️",
  },
  {
    value: "LARGE" as const,
    label: "Large",
    swahili: "Kubwa",
    description: "Bulky items — may affect fare",
    icon: "📦",
  },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface ParcelDetailsFormProps {
  /** Label variant based on trip type */
  mode?: "PARCEL_DELIVERY" | "ERRAND";
  onChange?: () => void;
}

export function ParcelDetailsForm({
  mode = "PARCEL_DELIVERY",
  onChange,
}: ParcelDetailsFormProps) {
  const parcelMeta = useTripStore(selectParcelMeta);
  const { setParcelMeta } = useTripStore();

  const isErrand = mode === "ERRAND";

  function update<K extends keyof NonNullable<typeof parcelMeta>>(
    key: K,
    value: NonNullable<typeof parcelMeta>[K]
  ) {
    setParcelMeta({ [key]: value } as any);
    onChange?.();
  }

  const meta = parcelMeta ?? {
    size: "SMALL",
    description: "",
    recipientName: "",
    recipientPhone: "",
    requiresSignature: false,
  };

  return (
    <div className="w-full space-y-5">
      {/* Size selector */}
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          {isErrand ? "Item size" : "Parcel size"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_OPTIONS.map((opt) => {
            const selected = meta.size === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => update("size", opt.value)}
                aria-pressed={selected}
                className={[
                  "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors",
                  selected
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-green-300",
                ].join(" ")}
              >
                <span className="text-xl" aria-hidden>{opt.icon}</span>
                <span
                  className={[
                    "text-xs font-semibold",
                    selected
                      ? "text-green-700 dark:text-green-300"
                      : "text-gray-700 dark:text-gray-300",
                  ].join(" ")}
                >
                  {opt.label}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="parcel-desc"
          className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5"
        >
          {isErrand ? "What do you need?" : "What's in the parcel?"}
        </label>
        <textarea
          id="parcel-desc"
          rows={2}
          value={meta.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder={
            isErrand
              ? "e.g. Buy 2kg sugar and 1L milk from Naivas"
              : "e.g. A4 documents, fragile — handle with care"
          }
          maxLength={300}
          className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="mt-1 text-right text-xs text-gray-400">
          {meta.description.length}/300
        </p>
      </div>

      {/* Recipient */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Recipient details
        </p>

        <div>
          <label
            htmlFor="recipient-name"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
          >
            Full name
          </label>
          <input
            id="recipient-name"
            type="text"
            value={meta.recipientName}
            onChange={(e) => update("recipientName", e.target.value)}
            placeholder="e.g. Jane Wanjiku"
            autoComplete="name"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="recipient-phone"
            className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
          >
            Phone number
          </label>
          <div className="flex gap-2 items-center">
            <span className="flex-shrink-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 select-none">
              🇰🇪 +254
            </span>
            <input
              id="recipient-phone"
              type="tel"
              value={meta.recipientPhone.replace(/^\+?254|^0/, "")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "").slice(0, 9);
                update("recipientPhone", raw ? `0${raw}` : "");
              }}
              placeholder="7XX XXX XXX"
              inputMode="numeric"
              className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Signature requirement */}
      <label className="flex items-start gap-3 cursor-pointer">
        <div className="flex-shrink-0 mt-0.5">
          <div
            role="checkbox"
            aria-checked={meta.requiresSignature}
            tabIndex={0}
            onClick={() => update("requiresSignature", !meta.requiresSignature)}
            onKeyDown={(e) =>
              e.key === " " && update("requiresSignature", !meta.requiresSignature)
            }
            className={[
              "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer",
              meta.requiresSignature
                ? "border-green-500 bg-green-500"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800",
            ].join(" ")}
          >
            {meta.requiresSignature && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5L8 3" />
              </svg>
            )}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
            Require signature on delivery
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            Rider will confirm delivery with recipient's signature
          </p>
        </div>
      </label>
    </div>
  );
}
