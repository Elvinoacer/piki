"use client";

// ============================================================
// src/components/booking/ScheduledRidePicker.tsx
// Pikii — Date/time picker for SCHEDULED_RIDE trips
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useTripStore } from "@/stores/useTripStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MIN_ADVANCE_MINUTES = 30;
const MAX_ADVANCE_DAYS = 7;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format a Date to the local datetime-local input value (YYYY-MM-DDTHH:MM) */
function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Friendly display of the selected datetime */
function formatDisplay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─────────────────────────────────────────────
// Quick-pick presets
// ─────────────────────────────────────────────

function buildPresets(): { label: string; iso: string }[] {
  const now = new Date();

  function nextRound30(from: Date) {
    const d = new Date(from);
    const mins = d.getMinutes();
    const rem = 30 - (mins % 30);
    d.setMinutes(mins + rem, 0, 0);
    return d;
  }

  const earliest = addMinutes(now, MIN_ADVANCE_MINUTES);
  const p1 = nextRound30(earliest);
  const p2 = new Date(p1); p2.setMinutes(p2.getMinutes() + 30);
  const p3 = new Date(p1); p3.setHours(p3.getHours() + 2, 0, 0, 0);

  const tomorrow7am = addDays(now, 1);
  tomorrow7am.setHours(7, 0, 0, 0);

  function fmt(d: Date) {
    return d.toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return [
    { label: `Today ${fmt(p1)}`, iso: p1.toISOString() },
    { label: `Today ${fmt(p2)}`, iso: p2.toISOString() },
    { label: `Today ${fmt(p3)}`, iso: p3.toISOString() },
    { label: `Tomorrow 7:00 AM`, iso: tomorrow7am.toISOString() },
  ];
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface ScheduledRidePickerProps {
  onChange?: (iso: string) => void;
}

export function ScheduledRidePicker({ onChange }: ScheduledRidePickerProps) {
  const { scheduledAt, setScheduledAt } = useTripStore();

  const now = new Date();
  const minDatetime = toLocalInputValue(addMinutes(now, MIN_ADVANCE_MINUTES));
  const maxDatetime = toLocalInputValue(addDays(now, MAX_ADVANCE_DAYS));

  const [inputValue, setInputValue] = useState<string>(
    scheduledAt ? toLocalInputValue(new Date(scheduledAt)) : ""
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const presets = buildPresets();

  // Sync store → local input when store changes externally
  useEffect(() => {
    if (scheduledAt) {
      setInputValue(toLocalInputValue(new Date(scheduledAt)));
    }
  }, [scheduledAt]);

  const commit = useCallback(
    (iso: string) => {
      setScheduledAt(iso);
      onChange?.(iso);
      setValidationError(null);
    },
    [setScheduledAt, onChange]
  );

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputValue(val);

    if (!val) {
      setScheduledAt(null);
      return;
    }

    const selected = new Date(val);
    const earliest = addMinutes(new Date(), MIN_ADVANCE_MINUTES);
    const latest = addDays(new Date(), MAX_ADVANCE_DAYS);

    if (selected < earliest) {
      setValidationError(
        `Must be at least ${MIN_ADVANCE_MINUTES} minutes from now`
      );
      return;
    }
    if (selected > latest) {
      setValidationError(
        `Cannot book more than ${MAX_ADVANCE_DAYS} days in advance`
      );
      return;
    }

    commit(selected.toISOString());
  }

  function handlePreset(iso: string) {
    setInputValue(toLocalInputValue(new Date(iso)));
    commit(iso);
  }

  return (
    <div className="w-full space-y-4">
      <div>
        <label
          htmlFor="scheduled-at"
          className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5"
        >
          Pick date &amp; time
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Chagua tarehe na wakati
        </p>

        <input
          id="scheduled-at"
          type="datetime-local"
          value={inputValue}
          min={minDatetime}
          max={maxDatetime}
          onChange={handleInput}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />

        {validationError && (
          <p role="alert" className="mt-1.5 text-xs text-red-500 dark:text-red-400">
            {validationError}
          </p>
        )}

        {scheduledAt && !validationError && (
          <p className="mt-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
            ✓ {formatDisplay(scheduledAt)}
          </p>
        )}
      </div>

      {/* Quick-pick presets */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          Quick pick
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const isActive = scheduledAt === p.iso;
            return (
              <button
                key={p.iso}
                onClick={() => handlePreset(p.iso)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300",
                ].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Policy note */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Rides can be booked up to {MAX_ADVANCE_DAYS} days in advance. You can
        cancel for free up to 15 minutes before pickup.
      </p>
    </div>
  );
}
