"use client";

// ============================================================
// src/components/booking/BookingFlow.tsx
// Pikii — Full booking wizard orchestrator for Section 3.3
// ============================================================

import { useState } from "react";
import { useTripStore } from "@/stores/useTripStore";
import { TripTypeSelector } from "./TripTypeSelector";
import { MultiStopManager } from "./MultiStopManager";
import { ScheduledRidePicker } from "./ScheduledRidePicker";
import { ParcelDetailsForm } from "./ParcelDetailsForm";

// ─────────────────────────────────────────────
// Step header
// ─────────────────────────────────────────────

function StepHeader({
  step,
  total,
  label,
}: {
  step: number;
  total: number;
  label: string;
}) {
  return (
    <div className="mb-5">
      {/* Progress bar */}
      <div className="flex gap-1 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-all",
              i < step
                ? "bg-green-500"
                : "bg-gray-200 dark:bg-gray-700",
            ].join(" ")}
          />
        ))}
      </div>
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Step {step} of {total}
      </p>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
        {label}
      </h2>
    </div>
  );
}

// ─────────────────────────────────────────────
// Fare chip
// ─────────────────────────────────────────────

function FareChip() {
  const { estimatedFareKes, estimatedDistanceKm, surgeMultiplier } =
    useTripStore();

  if (!estimatedFareKes) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-2.5 mb-4">
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Est. fare</p>
        <p className="text-lg font-bold text-green-700 dark:text-green-300">
          KES {estimatedFareKes.toFixed(0)}
        </p>
      </div>
      {estimatedDistanceKm && (
        <div className="border-l border-green-200 dark:border-green-700 pl-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {estimatedDistanceKm.toFixed(1)} km
          </p>
        </div>
      )}
      {surgeMultiplier > 1.0 && (
        <div className="border-l border-green-200 dark:border-green-700 pl-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            🔥 {surgeMultiplier}× surge
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Location inputs (stub — wire to map/geocoder)
// ─────────────────────────────────────────────

function LocationInputs() {
  const { pickup, dropoff, setPickup, setDropoff, tripType } = useTripStore();

  // Stub: in production, these open a map or use an autocomplete component
  // such as Google Places Autocomplete or Mapbox Search.

  const isMultiStop = tripType === "MULTI_STOP";

  return (
    <div className="space-y-3">
      {/* Pickup */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Pickup location
        </label>
        <button
          onClick={() => {
            // TODO: open map/place picker — for now stub with a fixed location
            setPickup({
              lat: -1.2921,
              lng: 36.8219,
              address: "Nairobi CBD, Nairobi",
            });
          }}
          className={[
            "w-full rounded-xl border text-left px-3 py-3 text-sm transition-colors",
            pickup
              ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200"
              : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400",
          ].join(" ")}
        >
          {pickup ? (
            <span className="flex items-center gap-2">
              <span className="text-green-500">●</span>
              {pickup.address}
            </span>
          ) : (
            "Tap to set pickup location…"
          )}
        </button>
      </div>

      {/* Dropoff — hidden for MULTI_STOP (last stop is the dropoff) */}
      {!isMultiStop && (
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Destination
          </label>
          <button
            onClick={() => {
              // TODO: open map/place picker
              setDropoff({
                lat: -1.3032,
                lng: 36.7073,
                address: "Westlands, Nairobi",
              });
            }}
            className={[
              "w-full rounded-xl border text-left px-3 py-3 text-sm transition-colors",
              dropoff
                ? "border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400",
            ].join(" ")}
          >
            {dropoff ? (
              <span className="flex items-center gap-2">
                <span className="text-red-500">■</span>
                {dropoff.address}
              </span>
            ) : (
              "Tap to set destination…"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Confirm summary panel
// ─────────────────────────────────────────────

function ConfirmSummary() {
  const {
    tripType,
    pickup,
    dropoff,
    stops,
    scheduledAt,
    parcelMeta,
    clientNotes,
    estimatedFareKes,
    setClientNotes,
  } = useTripStore();

  const typeLabels: Record<string, string> = {
    BODA_RIDE: "Boda Ride",
    PARCEL_DELIVERY: "Parcel Delivery",
    ERRAND: "Errand",
    SCHEDULED_RIDE: "Scheduled Ride",
    MULTI_STOP: "Multi-stop Ride",
    FOOD_DELIVERY: "Food Delivery",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {/* Type */}
        <Row label="Type" value={typeLabels[tripType ?? ""] ?? tripType} />

        {/* Pickup */}
        {pickup && <Row label="Pickup" value={pickup.address} />}

        {/* Dropoff / Stops */}
        {tripType === "MULTI_STOP" ? (
          stops.map((s, i) => (
            <Row key={i} label={`Stop ${i + 1}`} value={s.address} />
          ))
        ) : (
          dropoff && <Row label="Destination" value={dropoff.address} />
        )}

        {/* Scheduled */}
        {scheduledAt && (
          <Row
            label="Scheduled"
            value={new Date(scheduledAt).toLocaleString("en-KE", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          />
        )}

        {/* Parcel info */}
        {parcelMeta?.description && (
          <Row label="Item(s)" value={parcelMeta.description} />
        )}
        {parcelMeta?.recipientName && (
          <Row label="Recipient" value={`${parcelMeta.recipientName} · ${parcelMeta.recipientPhone}`} />
        )}

        {/* Fare */}
        {estimatedFareKes && (
          <Row
            label="Est. fare"
            value={`KES ${estimatedFareKes.toFixed(0)}`}
            highlight
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="client-notes"
          className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
        >
          Notes for rider (optional)
        </label>
        <textarea
          id="client-notes"
          rows={2}
          value={clientNotes}
          onChange={(e) => setClientNotes(e.target.value)}
          placeholder="e.g. Call when you arrive, gate is on the left"
          maxLength={200}
          className="w-full resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span
        className={[
          "text-sm text-right",
          highlight
            ? "font-bold text-green-700 dark:text-green-300"
            : "text-gray-800 dark:text-gray-200",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main BookingFlow component
// ─────────────────────────────────────────────

interface BookingFlowProps {
  onTripCreated?: (tripId: string) => void;
}

export function BookingFlow({ onTripCreated }: BookingFlowProps) {
  const {
    step,
    tripType,
    pickup,
    dropoff,
    stops,
    scheduledAt,
    parcelMeta,
    setStep,
    goBack,
    setActiveTripId,
    buildPayload,
    resetBooking,
  } = useTripStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Determine if "Next" is enabled ────────

  function canAdvance() {
    switch (step) {
      case "SELECT_TYPE":
        return !!tripType;
      case "SET_LOCATIONS":
        if (tripType === "MULTI_STOP") return !!pickup && stops.length >= 1;
        return !!pickup && !!dropoff;
      case "ADD_DETAILS":
        if (tripType === "SCHEDULED_RIDE") return !!scheduledAt;
        if (tripType === "PARCEL_DELIVERY" || tripType === "ERRAND") {
          return (
            !!parcelMeta?.description &&
            !!parcelMeta?.recipientName &&
            !!parcelMeta?.recipientPhone
          );
        }
        return true;
      case "CONFIRM":
        return true;
      default:
        return false;
    }
  }

  // ── Step definitions ───────────────────────

  const TOTAL_STEPS = 4;

  function stepNumber() {
    return (
      {
        SELECT_TYPE: 1,
        SET_LOCATIONS: 2,
        ADD_DETAILS: 3,
        CONFIRM: 4,
        MATCHING: 4,
        ACTIVE: 4,
      }[step] ?? 1
    );
  }

  function stepLabel() {
    return (
      {
        SELECT_TYPE: "What do you need?",
        SET_LOCATIONS: "Where to?",
        ADD_DETAILS: "Extra details",
        CONFIRM: "Confirm booking",
        MATCHING: "Finding Rider",
        ACTIVE: "Trip Active",
      }[step] ?? ""
    );
  }

  // ── Determine if ADD_DETAILS step is needed ─

  function needsDetailsStep() {
    return (
      tripType === "SCHEDULED_RIDE" ||
      tripType === "PARCEL_DELIVERY" ||
      tripType === "ERRAND" ||
      tripType === "MULTI_STOP"
    );
  }

  // ── Next button action ─────────────────────

  function handleNext() {
    if (step === "SELECT_TYPE") {
      setStep("SET_LOCATIONS");
    } else if (step === "SET_LOCATIONS") {
      setStep(needsDetailsStep() ? "ADD_DETAILS" : "CONFIRM");
    } else if (step === "ADD_DETAILS") {
      setStep("CONFIRM");
    } else if (step === "CONFIRM") {
      handleSubmit();
    }
  }

  // ── Submit ─────────────────────────────────

  async function handleSubmit() {
    const payload = buildPayload();
    if (!payload) {
      setSubmitError("Missing required fields. Please go back and check.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(
          data.error ?? "Something went wrong. Please try again."
        );
        return;
      }

      setActiveTripId(data.trip.id);
      onTripCreated?.(data.trip.id);
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Render matching / active states ────────

  if (step === "MATCHING" || step === "ACTIVE") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🏍️</span>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {step === "MATCHING" ? "Finding your rider…" : "Rider on the way"}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {step === "MATCHING"
              ? "We're matching you with a nearby rider"
              : "Track your ride on the map"}
          </p>
        </div>
        <button
          onClick={resetBooking}
          className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <StepHeader
          step={stepNumber()}
          total={needsDetailsStep() ? TOTAL_STEPS : TOTAL_STEPS - 1}
          label={stepLabel()}
        />

        {/* Fare estimate (show from SET_LOCATIONS onward) */}
        {step !== "SELECT_TYPE" && <FareChip />}

        {/* Step panels */}
        {step === "SELECT_TYPE" && <TripTypeSelector />}

        {step === "SET_LOCATIONS" && (
          <div className="space-y-4">
            <LocationInputs />
            {/* Multi-stop: show stop manager inline with location step */}
            {tripType === "MULTI_STOP" && <MultiStopManager />}
          </div>
        )}

        {step === "ADD_DETAILS" && (
          <>
            {(tripType === "PARCEL_DELIVERY" || tripType === "ERRAND") && (
              <ParcelDetailsForm mode={tripType} />
            )}
            {tripType === "SCHEDULED_RIDE" && <ScheduledRidePicker />}
          </>
        )}

        {step === "CONFIRM" && <ConfirmSummary />}
      </div>

      {/* Footer actions */}
      <div className="pt-4 space-y-2">
        {submitError && (
          <p role="alert" className="text-sm text-red-500 dark:text-red-400 text-center">
            {submitError}
          </p>
        )}

        <button
          onClick={handleNext}
          disabled={!canAdvance() || isSubmitting}
          className="w-full rounded-2xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-semibold py-4 text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            "Booking…"
          ) : step === "CONFIRM" ? (
            "Confirm Booking"
          ) : (
            "Next"
          )}
        </button>

        {step !== "SELECT_TYPE" && (
          <button
            onClick={goBack}
            className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
