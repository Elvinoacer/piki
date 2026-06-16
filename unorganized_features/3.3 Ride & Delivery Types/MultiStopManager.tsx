"use client";

// ============================================================
// src/components/booking/MultiStopManager.tsx
// Pikii — Add/remove/reorder waypoints for MULTI_STOP trips
// ============================================================

import { useState } from "react";
import { useTripStore, selectStops } from "@/stores/useTripStore";

const MAX_STOPS = 5;

// ─────────────────────────────────────────────
// Fake geocode — replace with your Maps API call
// ─────────────────────────────────────────────

async function geocodeAddress(query: string) {
  // TODO: call Google Maps Geocoding API / Mapbox
  // Returning stub for now
  return {
    lat: -1.286389 + Math.random() * 0.01,
    lng: 36.817223 + Math.random() * 0.01,
    address: query,
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

interface MultiStopManagerProps {
  /** Called whenever stop list changes — lets parent re-fetch fare estimate */
  onChange?: () => void;
}

export function MultiStopManager({ onChange }: MultiStopManagerProps) {
  const stops = useTripStore(selectStops);
  const { addStop, removeStop, reorderStop, updateStop } = useTripStore();

  const [inputValue, setInputValue] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Add a new stop ─────────────────────────

  async function handleAdd() {
    const query = inputValue.trim();
    if (!query) return;
    if (stops.length >= MAX_STOPS) {
      setError(`Maximum ${MAX_STOPS} stops reached`);
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const resolved = await geocodeAddress(query);
      addStop({
        lat: resolved.lat,
        lng: resolved.lng,
        address: resolved.address,
        label: inputLabel.trim() || undefined,
      });
      setInputValue("");
      setInputLabel("");
      onChange?.();
    } catch {
      setError("Could not find that location. Try a more specific address.");
    } finally {
      setIsAdding(false);
    }
  }

  // ── Reorder (simple up/down) ───────────────

  function moveUp(index: number) {
    if (index === 0) return;
    reorderStop(index, index - 1);
    onChange?.();
  }

  function moveDown(index: number) {
    if (index === stops.length - 1) return;
    reorderStop(index, index + 1);
    onChange?.();
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Stops ({stops.length}/{MAX_STOPS})
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Extra fare applies per stop
        </span>
      </div>

      {/* Stop list */}
      {stops.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
          No stops added yet. Add a stop below.
        </p>
      ) : (
        <ol className="space-y-2" aria-label="Trip stops">
          {stops.map((stop, i) => (
            <li
              key={`stop-${i}`}
              className="flex items-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
            >
              {/* Order badge */}
              <span
                className="mt-0.5 flex-shrink-0 h-6 w-6 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex items-center justify-center"
                aria-hidden
              >
                {i + 1}
              </span>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white truncate">
                  {stop.address}
                </p>
                {stop.label && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {stop.label}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Move up */}
                <button
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  aria-label={`Move stop ${i + 1} up`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12V4M4 8l4-4 4 4" />
                  </svg>
                </button>

                {/* Move down */}
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === stops.length - 1}
                  aria-label={`Move stop ${i + 1} down`}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v8M4 8l4 4 4-4" />
                  </svg>
                </button>

                {/* Remove */}
                <button
                  onClick={() => { removeStop(i); onChange?.(); }}
                  aria-label={`Remove stop ${i + 1}`}
                  className="p-1.5 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h8" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Add stop form */}
      {stops.length < MAX_STOPS && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Enter stop address…"
                aria-label="Stop address"
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="text"
                value={inputLabel}
                onChange={(e) => setInputLabel(e.target.value)}
                placeholder="Label (optional) — e.g. Pick up laundry"
                aria-label="Stop label"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleAdd}
              disabled={isAdding || !inputValue.trim()}
              aria-label="Add stop"
              className="self-start flex-shrink-0 mt-0 rounded-xl bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49 2.83-2.83" />
                  </svg>
                  <span>Adding…</span>
                </span>
              ) : (
                "+ Add"
              )}
            </button>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-500 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
      )}

      {stops.length >= MAX_STOPS && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Maximum {MAX_STOPS} stops reached.
        </p>
      )}
    </div>
  );
}
