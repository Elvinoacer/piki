/**
 * stores/useTripStore.ts
 *
 * Active trip state for both client and rider views.
 * Hydrated by WebSocket events and API responses.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { TripStatus, TripType } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────

export interface ActiveTrip {
  id: string;
  status: TripStatus;
  type: TripType;

  // Locations
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;

  // Fare
  fareEstimate?: number;
  fareFinal?: number;
  currency: string;

  // Rider info (populated after acceptance)
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderPhoto?: string;
  riderRating?: number;
  vehiclePlate?: string;

  // Route
  routePolyline?: string;
  distanceKm?: number;
  estimatedMins?: number;
  etaMinutes?: number;    // Live ETA from Maps API

  // Searching state
  searchRadiusKm?: number;
  ridersFound?: number;
}

export interface RiderPosition {
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  ts: number;
}

interface TripState {
  activeTrip: ActiveTrip | null;
  riderPosition: RiderPosition | null;
  isSearching: boolean;
  isLoading: boolean;
  error: string | null;
}

interface TripActions {
  setActiveTrip: (trip: ActiveTrip) => void;
  updateStatus: (status: TripStatus, extra?: Partial<ActiveTrip>) => void;
  updateRiderPosition: (pos: RiderPosition) => void;
  setSearching: (searching: boolean, radiusKm?: number, ridersFound?: number) => void;
  setEta: (etaMinutes: number) => void;
  clearTrip: () => void;
  setError: (err: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// ─── Store ───────────────────────────────────────────────────

export const useTripStore = create<TripState & TripActions>()(
  immer((set) => ({
    // State
    activeTrip:     null,
    riderPosition:  null,
    isSearching:    false,
    isLoading:      false,
    error:          null,

    // Actions
    setActiveTrip: (trip) =>
      set((s) => {
        s.activeTrip    = trip;
        s.isSearching   = false;
        s.error         = null;
      }),

    updateStatus: (status, extra = {}) =>
      set((s) => {
        if (!s.activeTrip) return;
        s.activeTrip.status = status;
        Object.assign(s.activeTrip, extra);
      }),

    updateRiderPosition: (pos) =>
      set((s) => {
        s.riderPosition = pos;
      }),

    setSearching: (searching, radiusKm, ridersFound) =>
      set((s) => {
        s.isSearching = searching;
        if (s.activeTrip) {
          if (radiusKm   !== undefined) s.activeTrip.searchRadiusKm = radiusKm;
          if (ridersFound !== undefined) s.activeTrip.ridersFound    = ridersFound;
        }
      }),

    setEta: (etaMinutes) =>
      set((s) => {
        if (s.activeTrip) s.activeTrip.etaMinutes = etaMinutes;
      }),

    clearTrip: () =>
      set((s) => {
        s.activeTrip    = null;
        s.riderPosition = null;
        s.isSearching   = false;
        s.error         = null;
      }),

    setError: (err) =>
      set((s) => {
        s.error = err;
      }),

    setLoading: (loading) =>
      set((s) => {
        s.isLoading = loading;
      }),
  }))
);
