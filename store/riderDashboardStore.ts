// store/riderDashboardStore.ts
// Zustand store for the Rider Dashboard (PRD §3.9 + §4.4)

import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type {
  RiderStatus,
  IncomingRequest,
  EarningsSummary,
  TripHistoryItem,
  PayoutRequest,
  WalletBalance,
  PerformanceStats,
  RiderDocument,
  HeatmapPoint,
  RiderProfile,
} from "@/types/rider-dashboard";

// ─── Active trip state (shared with useTripStore in PRD §4.4) ───────────────

export interface ActiveTrip {
  tripId: string;
  status: string;
  clientName: string;
  clientAvatar: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
}

// ─── State shape ─────────────────────────────────────────────────────────────

interface RiderDashboardState {
  // Rider identity & online status
  rider: RiderProfile | null;
  riderStatus: RiderStatus;

  // Incoming request (one at a time per PRD §4.3)
  incomingRequest: IncomingRequest | null;
  countdownSeconds: number;

  // Active trip
  activeTrip: ActiveTrip | null;

  // Earnings
  earnings: EarningsSummary | null;

  // Trip history
  tripHistory: TripHistoryItem[];
  tripHistoryPage: number;
  tripHistoryHasMore: boolean;

  // Payouts
  payouts: PayoutRequest[];
  wallet: WalletBalance | null;

  // Performance
  performance: PerformanceStats | null;

  // Documents
  documents: RiderDocument[];

  // Heatmap
  heatmapPoints: HeatmapPoint[];

  // UI state
  activeTab:
    | "overview"
    | "earnings"
    | "history"
    | "payouts"
    | "stats"
    | "documents"
    | "heatmap";
  isLoading: boolean;
  error: string | null;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

interface RiderDashboardActions {
  // Init
  setInitialData: (data: Partial<RiderDashboardState>) => void;

  // Status toggle
  setRiderStatus: (status: RiderStatus) => void;

  // Incoming request
  setIncomingRequest: (req: IncomingRequest | null) => void;
  tickCountdown: () => void;
  clearRequest: () => void;

  // Trip actions
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  setActiveTrip: (trip: ActiveTrip | null) => void;

  // Earnings
  setEarnings: (earnings: EarningsSummary) => void;

  // Trip history
  appendTripHistory: (trips: TripHistoryItem[], hasMore: boolean) => void;
  incrementHistoryPage: () => void;

  // Payouts
  requestPayout: (amount: number, phoneNumber: string) => Promise<void>;
  setPayouts: (payouts: PayoutRequest[]) => void;
  setWallet: (wallet: WalletBalance) => void;

  // Performance
  setPerformance: (stats: PerformanceStats) => void;

  // Documents
  setDocuments: (docs: RiderDocument[]) => void;

  // Heatmap
  setHeatmapPoints: (points: HeatmapPoint[]) => void;

  // UI
  setActiveTab: (tab: RiderDashboardState["activeTab"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

type RiderDashboardStore = RiderDashboardState & RiderDashboardActions;

// ─── Store ───────────────────────────────────────────────────────────────────

export const useRiderDashboardStore = create<RiderDashboardStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      rider: null,
      riderStatus: "OFFLINE",
      incomingRequest: null,
      countdownSeconds: 0,
      activeTrip: null,
      earnings: null,
      tripHistory: [],
      tripHistoryPage: 1,
      tripHistoryHasMore: true,
      payouts: [],
      wallet: null,
      performance: null,
      documents: [],
      heatmapPoints: [],
      activeTab: "overview",
      isLoading: false,
      error: null,

      // ── Actions ─────────────────────────────────────────────────────────────

      setInitialData: (data) => set({ ...data }),

      setRiderStatus: (status) => {
        set({ riderStatus: status });
        // Fire-and-forget: update status on server
        fetch("/api/rider/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }).catch(console.error);
      },

      setIncomingRequest: (req) =>
        set({
          incomingRequest: req,
          countdownSeconds: req?.countdownSeconds ?? 0,
        }),

      tickCountdown: () =>
        set((state) => {
          const next = state.countdownSeconds - 1;
          if (next <= 0) {
            return { countdownSeconds: 0, incomingRequest: null };
          }
          return { countdownSeconds: next };
        }),

      clearRequest: () =>
        set({ incomingRequest: null, countdownSeconds: 0 }),

      acceptRequest: async (requestId) => {
        set({ isLoading: true });
        try {
          const res = await fetch(`/api/rider/requests/${requestId}/accept`, {
            method: "POST",
          });
          if (!res.ok) throw new Error("Failed to accept request");
          const { trip } = await res.json();
          set({
            incomingRequest: null,
            countdownSeconds: 0,
            activeTrip: trip,
            riderStatus: "ON_TRIP",
          });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ isLoading: false });
        }
      },

      declineRequest: async (requestId) => {
        set({ isLoading: true });
        try {
          await fetch(`/api/rider/requests/${requestId}/decline`, {
            method: "POST",
          });
          set({ incomingRequest: null, countdownSeconds: 0 });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ isLoading: false });
        }
      },

      setActiveTrip: (trip) => set({ activeTrip: trip }),

      setEarnings: (earnings) => set({ earnings }),

      appendTripHistory: (trips, hasMore) =>
        set((state) => ({
          tripHistory: [...state.tripHistory, ...trips],
          tripHistoryHasMore: hasMore,
        })),

      incrementHistoryPage: () =>
        set((state) => ({ tripHistoryPage: state.tripHistoryPage + 1 })),

      requestPayout: async (amount, phoneNumber) => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch("/api/rider/payouts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount, phoneNumber }),
          });
          if (!res.ok) {
            const { message } = await res.json();
            throw new Error(message ?? "Payout request failed");
          }
          const { payout, wallet } = await res.json();
          set((state) => ({
            payouts: [payout, ...state.payouts],
            wallet,
          }));
        } catch (err) {
          set({ error: (err as Error).message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      setPayouts: (payouts) => set({ payouts }),
      setWallet: (wallet) => set({ wallet }),
      setPerformance: (performance) => set({ performance }),
      setDocuments: (documents) => set({ documents }),
      setHeatmapPoints: (heatmapPoints) => set({ heatmapPoints }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    })),
    { name: "RiderDashboardStore" }
  )
);
