// ============================================================
// src/stores/useTripStore.ts
// Pikii — Zustand store for Section 3.3 trip booking state
// ============================================================

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { CreateTripInput, TripStopInput } from "@/lib/validations/trip";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TripType =
  | "BODA_RIDE"
  | "PARCEL_DELIVERY"
  | "ERRAND"
  | "FOOD_DELIVERY"
  | "SCHEDULED_RIDE"
  | "MULTI_STOP";

export interface LocationPin {
  lat: number;
  lng: number;
  address: string;
}

export interface ParcelMeta {
  size: "SMALL" | "MEDIUM" | "LARGE";
  description: string;
  recipientName: string;
  recipientPhone: string;
  requiresSignature: boolean;
}

export type BookingStep =
  | "SELECT_TYPE"   // Step 1 — choose trip type
  | "SET_LOCATIONS" // Step 2 — pick pickup / dropoff
  | "ADD_DETAILS"   // Step 3 — parcel info, schedule, stops
  | "CONFIRM"       // Step 4 — review + confirm
  | "MATCHING"      // Submitted — waiting for rider
  | "ACTIVE";       // Rider accepted — trip underway

// ─────────────────────────────────────────────
// Store shape
// ─────────────────────────────────────────────

interface TripState {
  // Booking wizard
  step: BookingStep;

  // Selected type
  tripType: TripType | null;

  // Locations
  pickup: LocationPin | null;
  dropoff: LocationPin | null;

  // Multi-stop waypoints
  stops: TripStopInput[];

  // Scheduled ride
  scheduledAt: string | null; // ISO-8601

  // Parcel / errand metadata
  parcelMeta: ParcelMeta | null;

  // Misc
  clientNotes: string;

  // Fare estimate (populated after locations are set)
  estimatedFareKes: number | null;
  estimatedDistanceKm: number | null;
  estimatedDurationMinutes: number | null;
  surgeMultiplier: number;

  // Active trip (after submission)
  activeTripId: string | null;
  activeStatus:
    | "PENDING"
    | "BROADCAST"
    | "ACCEPTED"
    | "ARRIVING"
    | "ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | null;
}

interface TripActions {
  // Wizard navigation
  setStep: (step: BookingStep) => void;
  goBack: () => void;

  // Type selection
  setTripType: (type: TripType) => void;

  // Location setters
  setPickup: (pin: LocationPin) => void;
  setDropoff: (pin: LocationPin) => void;
  clearLocations: () => void;

  // Multi-stop management
  addStop: (stop: Omit<TripStopInput, "order">) => void;
  removeStop: (index: number) => void;
  reorderStop: (fromIndex: number, toIndex: number) => void;
  updateStop: (index: number, partial: Partial<TripStopInput>) => void;
  clearStops: () => void;

  // Scheduling
  setScheduledAt: (iso: string | null) => void;

  // Parcel metadata
  setParcelMeta: (meta: Partial<ParcelMeta>) => void;
  clearParcelMeta: () => void;

  // Notes
  setClientNotes: (notes: string) => void;

  // Fare
  setFareEstimate: (data: {
    fareKes: number;
    distanceKm: number;
    durationMinutes: number;
    surgeMultiplier?: number;
  }) => void;
  clearFareEstimate: () => void;

  // Active trip
  setActiveTripId: (id: string) => void;
  setActiveStatus: (status: TripState["activeStatus"]) => void;

  // Full reset (new booking)
  resetBooking: () => void;

  // Build the API payload from current state
  buildPayload: () => CreateTripInput | null;
}

// ─────────────────────────────────────────────
// Step ordering (for goBack)
// ─────────────────────────────────────────────

const STEP_ORDER: BookingStep[] = [
  "SELECT_TYPE",
  "SET_LOCATIONS",
  "ADD_DETAILS",
  "CONFIRM",
];

// ─────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────

const initialState: TripState = {
  step: "SELECT_TYPE",
  tripType: null,
  pickup: null,
  dropoff: null,
  stops: [],
  scheduledAt: null,
  parcelMeta: null,
  clientNotes: "",
  estimatedFareKes: null,
  estimatedDistanceKm: null,
  estimatedDurationMinutes: null,
  surgeMultiplier: 1.0,
  activeTripId: null,
  activeStatus: null,
};

// ─────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────

export const useTripStore = create<TripState & TripActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ── Wizard navigation ──────────────────

      setStep: (step) => set({ step }, false, "setStep"),

      goBack: () => {
        const { step } = get();
        const idx = STEP_ORDER.indexOf(step);
        if (idx > 0) {
          set({ step: STEP_ORDER[idx - 1] }, false, "goBack");
        }
      },

      // ── Type selection ─────────────────────

      setTripType: (tripType) =>
        set(
          {
            tripType,
            // Reset type-specific state when switching
            parcelMeta: null,
            scheduledAt: null,
            stops: [],
            step: "SET_LOCATIONS",
          },
          false,
          "setTripType"
        ),

      // ── Location setters ───────────────────

      setPickup: (pickup) => set({ pickup }, false, "setPickup"),

      setDropoff: (dropoff) => set({ dropoff }, false, "setDropoff"),

      clearLocations: () =>
        set(
          { pickup: null, dropoff: null, estimatedFareKes: null },
          false,
          "clearLocations"
        ),

      // ── Multi-stop management ──────────────

      addStop: (stop) =>
        set(
          (state) => ({
            stops: [
              ...state.stops,
              { ...stop, order: state.stops.length },
            ],
          }),
          false,
          "addStop"
        ),

      removeStop: (index) =>
        set(
          (state) => ({
            stops: state.stops
              .filter((_, i) => i !== index)
              .map((s, i) => ({ ...s, order: i })),
          }),
          false,
          "removeStop"
        ),

      reorderStop: (fromIndex, toIndex) =>
        set(
          (state) => {
            const next = [...state.stops];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return { stops: next.map((s, i) => ({ ...s, order: i })) };
          },
          false,
          "reorderStop"
        ),

      updateStop: (index, partial) =>
        set(
          (state) => ({
            stops: state.stops.map((s, i) =>
              i === index ? { ...s, ...partial } : s
            ),
          }),
          false,
          "updateStop"
        ),

      clearStops: () => set({ stops: [] }, false, "clearStops"),

      // ── Scheduling ─────────────────────────

      setScheduledAt: (scheduledAt) =>
        set({ scheduledAt }, false, "setScheduledAt"),

      // ── Parcel metadata ────────────────────

      setParcelMeta: (meta) =>
        set(
          (state) => ({
            parcelMeta: {
              size: "SMALL",
              description: "",
              recipientName: "",
              recipientPhone: "",
              requiresSignature: false,
              ...state.parcelMeta,
              ...meta,
            },
          }),
          false,
          "setParcelMeta"
        ),

      clearParcelMeta: () =>
        set({ parcelMeta: null }, false, "clearParcelMeta"),

      // ── Notes ──────────────────────────────

      setClientNotes: (clientNotes) =>
        set({ clientNotes }, false, "setClientNotes"),

      // ── Fare ───────────────────────────────

      setFareEstimate: ({ fareKes, distanceKm, durationMinutes, surgeMultiplier = 1.0 }) =>
        set(
          {
            estimatedFareKes: fareKes,
            estimatedDistanceKm: distanceKm,
            estimatedDurationMinutes: durationMinutes,
            surgeMultiplier,
          },
          false,
          "setFareEstimate"
        ),

      clearFareEstimate: () =>
        set(
          {
            estimatedFareKes: null,
            estimatedDistanceKm: null,
            estimatedDurationMinutes: null,
            surgeMultiplier: 1.0,
          },
          false,
          "clearFareEstimate"
        ),

      // ── Active trip ────────────────────────

      setActiveTripId: (activeTripId) =>
        set(
          { activeTripId, step: "MATCHING", activeStatus: "PENDING" },
          false,
          "setActiveTripId"
        ),

      setActiveStatus: (activeStatus) =>
        set(
          {
            activeStatus,
            step:
              activeStatus === "ACCEPTED" ||
              activeStatus === "ARRIVING" ||
              activeStatus === "ARRIVED" ||
              activeStatus === "IN_PROGRESS"
                ? "ACTIVE"
                : get().step,
          },
          false,
          "setActiveStatus"
        ),

      // ── Full reset ─────────────────────────

      resetBooking: () => set(initialState, false, "resetBooking"),

      // ── Build API payload ──────────────────

      buildPayload: (): CreateTripInput | null => {
        const {
          tripType,
          pickup,
          dropoff,
          stops,
          scheduledAt,
          parcelMeta,
          clientNotes,
        } = get();

        if (!tripType || !pickup) return null;

        const base = {
          pickup,
          clientNotes: clientNotes || undefined,
        };

        switch (tripType) {
          case "BODA_RIDE":
            if (!dropoff) return null;
            return { type: "BODA_RIDE", ...base, dropoff };

          case "PARCEL_DELIVERY":
          case "ERRAND":
            if (!dropoff || !parcelMeta) return null;
            return {
              type: tripType,
              ...base,
              dropoff,
              parcelSize: parcelMeta.size,
              parcelDescription: parcelMeta.description,
              recipientName: parcelMeta.recipientName,
              recipientPhone: parcelMeta.recipientPhone,
              requiresSignature: parcelMeta.requiresSignature,
            };

          case "SCHEDULED_RIDE":
            if (!dropoff || !scheduledAt) return null;
            return {
              type: "SCHEDULED_RIDE",
              ...base,
              dropoff,
              scheduledAt,
            };

          case "MULTI_STOP":
            if (stops.length === 0) return null;
            return { type: "MULTI_STOP", ...base, stops };

          case "FOOD_DELIVERY":
            // Food delivery payload requires merchantId from merchant context
            // This branch is intentionally thin until Phase 4
            return null;

          default:
            return null;
        }
      },
    }),
    { name: "TripStore" }
  )
);

// ─────────────────────────────────────────────
// Selectors (memoisation-friendly)
// ─────────────────────────────────────────────

export const selectTripType = (s: TripState & TripActions) => s.tripType;
export const selectStep = (s: TripState & TripActions) => s.step;
export const selectLocations = (s: TripState & TripActions) => ({
  pickup: s.pickup,
  dropoff: s.dropoff,
});
export const selectStops = (s: TripState & TripActions) => s.stops;
export const selectFare = (s: TripState & TripActions) => ({
  estimatedFareKes: s.estimatedFareKes,
  estimatedDistanceKm: s.estimatedDistanceKm,
  estimatedDurationMinutes: s.estimatedDurationMinutes,
  surgeMultiplier: s.surgeMultiplier,
});
export const selectParcelMeta = (s: TripState & TripActions) => s.parcelMeta;
export const selectScheduledAt = (s: TripState & TripActions) => s.scheduledAt;
export const selectActiveTrip = (s: TripState & TripActions) => ({
  activeTripId: s.activeTripId,
  activeStatus: s.activeStatus,
});
