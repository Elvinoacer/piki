"use client";

// ============================================================
// src/components/booking/TripTypeSelector.tsx
// Pikii — Step 1: choose ride/delivery type
// ============================================================

import { useTripStore } from "@/stores/useTripStore";
import type { TripType } from "@/stores/useTripStore";

// ─────────────────────────────────────────────
// Trip type metadata
// ─────────────────────────────────────────────

interface TripTypeOption {
  type: TripType;
  label: string;
  swahili: string;
  description: string;
  icon: string;        // emoji — swap for icon library if desired
  available: boolean;  // false = future phase, shown but disabled
  badge?: string;
}

const TRIP_TYPES: TripTypeOption[] = [
  {
    type: "BODA_RIDE",
    label: "Boda Ride",
    swahili: "Panda Boda",
    description: "Get a ride to any destination",
    icon: "🏍️",
    available: true,
  },
  {
    type: "PARCEL_DELIVERY",
    label: "Parcel Delivery",
    swahili: "Tuma Kifurushi",
    description: "Send packages, documents, or items",
    icon: "📦",
    available: true,
  },
  {
    type: "ERRAND",
    label: "Errand",
    swahili: "Kazi Ndogo",
    description: "Shopping, banking, and more",
    icon: "🛍️",
    available: true,
  },
  {
    type: "SCHEDULED_RIDE",
    label: "Scheduled Ride",
    swahili: "Panga Safari",
    description: "Book a ride in advance",
    icon: "🗓️",
    available: true,
  },
  {
    type: "MULTI_STOP",
    label: "Multi-stop",
    swahili: "Vituo Vingi",
    description: "Add stops along your route",
    icon: "📍",
    available: true,
  },
  {
    type: "FOOD_DELIVERY",
    label: "Food Delivery",
    swahili: "Agiza Chakula",
    description: "Order from local restaurants",
    icon: "🍲",
    available: false,
    badge: "Coming soon",
  },
];

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface TripTypeSelectorProps {
  /** Callback fired after a type is selected (optional — store is updated internally) */
  onSelect?: (type: TripType) => void;
}

export function TripTypeSelector({ onSelect }: TripTypeSelectorProps) {
  const { tripType, setTripType } = useTripStore();

  function handleSelect(option: TripTypeOption) {
    if (!option.available) return;
    setTripType(option.type);
    onSelect?.(option.type);
  }

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        What do you need?
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Unataka nini?
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TRIP_TYPES.map((option) => {
          const isSelected = tripType === option.type;
          const isDisabled = !option.available;

          return (
            <button
              key={option.type}
              onClick={() => handleSelect(option)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={`${option.label} — ${option.description}`}
              className={[
                // Base
                "relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left",
                "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-green-500 focus-visible:ring-offset-2",
                "min-h-[100px]", // large tap target for mid-range Android
                // Selected
                isSelected
                  ? "border-green-500 bg-green-50 dark:bg-green-950 dark:border-green-400 shadow-sm"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
                // Hover (available)
                !isDisabled && !isSelected
                  ? "hover:border-green-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  : "",
                // Disabled
                isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "",
              ].join(" ")}
            >
              {/* Badge */}
              {option.badge && (
                <span className="absolute top-2 right-2 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-2 py-0.5 leading-tight">
                  {option.badge}
                </span>
              )}

              {/* Icon */}
              <span className="text-2xl leading-none" aria-hidden>
                {option.icon}
              </span>

              {/* Labels */}
              <div>
                <p
                  className={[
                    "text-sm font-semibold leading-tight",
                    isSelected
                      ? "text-green-700 dark:text-green-300"
                      : "text-gray-900 dark:text-white",
                  ].join(" ")}
                >
                  {option.label}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {option.swahili}
                </p>
              </div>

              {/* Checkmark */}
              {isSelected && (
                <span
                  className="absolute top-3 right-3 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center"
                  aria-hidden
                >
                  <svg
                    className="h-2.5 w-2.5 text-white"
                    fill="none"
                    viewBox="0 0 10 10"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2 5l2.5 2.5L8 3"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Description of selected type */}
      {tripType && (
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
          {TRIP_TYPES.find((t) => t.type === tripType)?.description}
        </p>
      )}
    </div>
  );
}
