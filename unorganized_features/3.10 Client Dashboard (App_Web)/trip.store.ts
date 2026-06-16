import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ActiveTrip,
  BookingRequest,
  FareEstimate,
  TripStatus,
  ActiveRiderLocation,
} from "@/types/client-dashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingStep = "idle" | "selecting" | "estimating" | "confirming" | "searching" | "active" | "rating";

interface TripStoreState {
  // Booking flow
  step: BookingStep;
  bookingRequest: Partial<BookingRequest>;
  fareEstimate: FareEstimate | null;
  isEstimating: boolean;

  // Active trip
  activeTrip: ActiveTrip | null;
  riderLocation: ActiveRiderLocation | null;

  // Rating
  pendingRatingTripId: string | null;
}

interface TripStoreActions {
  // Booking actions
  setStep: (step: BookingStep) => void;
  updateBookingRequest: (patch: Partial<BookingRequest>) => void;
  setFareEstimate: (estimate: FareEstimate | null) => void;
  setIsEstimating: (v: boolean) => void;
  resetBooking: () => void;

  // Trip actions
  setActiveTrip: (trip: ActiveTrip | null) => void;
  updateTripStatus: (status: TripStatus) => void;
  updateRiderLocation: (location: ActiveRiderLocation) => void;
  updateEta: (etaMinutes: number) => void;

  // Rating
  triggerRating: (tripId: string) => void;
  clearRating: () => void;
}

type TripStore = TripStoreState & TripStoreActions;

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: TripStoreState = {
  step: "idle",
  bookingRequest: {},
  fareEstimate: null,
  isEstimating: false,
  activeTrip: null,
  riderLocation: null,
  pendingRatingTripId: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTripStore = create<TripStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // Booking
      setStep: (step) => set({ step }, false, "setStep"),

      updateBookingRequest: (patch) =>
        set(
          (s) => ({ bookingRequest: { ...s.bookingRequest, ...patch } }),
          false,
          "updateBookingRequest"
        ),

      setFareEstimate: (fareEstimate) =>
        set({ fareEstimate }, false, "setFareEstimate"),

      setIsEstimating: (isEstimating) =>
        set({ isEstimating }, false, "setIsEstimating"),

      resetBooking: () =>
        set(
          { step: "idle", bookingRequest: {}, fareEstimate: null, isEstimating: false },
          false,
          "resetBooking"
        ),

      // Active trip
      setActiveTrip: (activeTrip) =>
        set(
          { activeTrip, step: activeTrip ? "active" : "idle" },
          false,
          "setActiveTrip"
        ),

      updateTripStatus: (status) =>
        set(
          (s) =>
            s.activeTrip
              ? { activeTrip: { ...s.activeTrip, status } }
              : s,
          false,
          "updateTripStatus"
        ),

      updateRiderLocation: (riderLocation) =>
        set(
          (s) => ({
            riderLocation,
            activeTrip: s.activeTrip
              ? { ...s.activeTrip, riderLocation }
              : null,
          }),
          false,
          "updateRiderLocation"
        ),

      updateEta: (etaMinutes) =>
        set(
          (s) =>
            s.activeTrip
              ? { activeTrip: { ...s.activeTrip, etaMinutes } }
              : s,
          false,
          "updateEta"
        ),

      // Rating
      triggerRating: (tripId) =>
        set(
          { pendingRatingTripId: tripId, step: "rating" },
          false,
          "triggerRating"
        ),

      clearRating: () =>
        set(
          { pendingRatingTripId: null, step: "idle" },
          false,
          "clearRating"
        ),
    }),
    { name: "TripStore" }
  )
);
