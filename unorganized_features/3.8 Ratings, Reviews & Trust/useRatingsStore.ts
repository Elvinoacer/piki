// src/store/useRatingsStore.ts

import { create } from "zustand";
import type {
  RatingResponse,
  TrustScoreResponse,
  DisputeResponse,
  RatingSummaryForTrip,
  SubmitRatingPayload,
  SubmitDisputePayload,
} from "@/types/ratings";

interface RatingsState {
  // ── Pending prompt ──────────────────────────────────────────
  /** tripId waiting for a rating — set after trip completes */
  pendingRatingTripId: string | null;
  setPendingRatingTripId: (tripId: string | null) => void;

  // ── Submission state ────────────────────────────────────────
  isSubmittingRating: boolean;
  ratingError: string | null;
  lastSubmittedRating: RatingResponse | null;

  // ── Dispute state ────────────────────────────────────────────
  isSubmittingDispute: boolean;
  disputeError: string | null;
  lastSubmittedDispute: DisputeResponse | null;

  // ── Rider trust cache (riderId → score) ──────────────────────
  trustScoreCache: Record<string, TrustScoreResponse>;

  // ── Trip rating summary cache ─────────────────────────────────
  tripRatingSummaryCache: Record<string, RatingSummaryForTrip>;

  // ── Actions ──────────────────────────────────────────────────
  submitRating: (payload: SubmitRatingPayload) => Promise<RatingResponse | null>;
  submitDispute: (payload: SubmitDisputePayload) => Promise<DisputeResponse | null>;
  fetchTrustScore: (riderId: string) => Promise<TrustScoreResponse | null>;
  fetchTripRatingSummary: (tripId: string) => Promise<RatingSummaryForTrip | null>;
  clearRatingError: () => void;
  clearDisputeError: () => void;
}

export const useRatingsStore = create<RatingsState>((set, get) => ({
  pendingRatingTripId: null,
  setPendingRatingTripId: (tripId) => set({ pendingRatingTripId: tripId }),

  isSubmittingRating: false,
  ratingError: null,
  lastSubmittedRating: null,

  isSubmittingDispute: false,
  disputeError: null,
  lastSubmittedDispute: null,

  trustScoreCache: {},
  tripRatingSummaryCache: {},

  submitRating: async (payload) => {
    set({ isSubmittingRating: true, ratingError: null });
    try {
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        set({ ratingError: json.error ?? "Failed to submit rating" });
        return null;
      }
      set({
        lastSubmittedRating: json,
        pendingRatingTripId: null,
        // Bust the summary cache for this trip
        tripRatingSummaryCache: Object.fromEntries(
          Object.entries(get().tripRatingSummaryCache).filter(
            ([k]) => k !== payload.tripId
          )
        ),
      });
      return json as RatingResponse;
    } catch {
      set({ ratingError: "Network error" });
      return null;
    } finally {
      set({ isSubmittingRating: false });
    }
  },

  submitDispute: async (payload) => {
    set({ isSubmittingDispute: true, disputeError: null });
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        set({ disputeError: json.error ?? "Failed to submit dispute" });
        return null;
      }
      set({ lastSubmittedDispute: json });
      return json as DisputeResponse;
    } catch {
      set({ disputeError: "Network error" });
      return null;
    } finally {
      set({ isSubmittingDispute: false });
    }
  },

  fetchTrustScore: async (riderId) => {
    const cached = get().trustScoreCache[riderId];
    if (cached) return cached;

    try {
      const res = await fetch(`/api/riders/${riderId}/trust`);
      if (!res.ok) return null;
      const data: TrustScoreResponse = await res.json();
      set((s) => ({
        trustScoreCache: { ...s.trustScoreCache, [riderId]: data },
      }));
      return data;
    } catch {
      return null;
    }
  },

  fetchTripRatingSummary: async (tripId) => {
    const cached = get().tripRatingSummaryCache[tripId];
    if (cached) return cached;

    try {
      const res = await fetch(`/api/ratings?tripId=${tripId}`);
      if (!res.ok) return null;
      const data: RatingSummaryForTrip = await res.json();
      set((s) => ({
        tripRatingSummaryCache: { ...s.tripRatingSummaryCache, [tripId]: data },
      }));
      return data;
    } catch {
      return null;
    }
  },

  clearRatingError: () => set({ ratingError: null }),
  clearDisputeError: () => set({ disputeError: null }),
}));
