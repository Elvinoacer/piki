// store/history-store.ts
// Feature 3.14 — Search, History & Receipts
// Zustand slice for trip history, filters, and receipt state

import { create } from "zustand";
import type {
  TripHistoryFilters,
  TripHistoryItem,
  TripHistoryResponse,
} from "@/types/history";

// ── Default filters ───────────────────────────────────────────
const DEFAULT_FILTERS: TripHistoryFilters = {
  search: "",
  dateFrom: null,
  dateTo: null,
  type: "ALL",
  status: "ALL",
  page: 1,
  pageSize: 10,
};

interface HistoryState {
  // Data
  trips: TripHistoryItem[];
  total: number;
  totalPages: number;

  // Filters
  filters: TripHistoryFilters;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Receipt state: tripId → { loading, url, error }
  receiptState: Record<
    string,
    { loading: boolean; url: string | null; error: string | null }
  >;

  // Actions
  setFilters: (partial: Partial<TripHistoryFilters>) => void;
  resetFilters: () => void;
  fetchHistory: () => Promise<void>;
  fetchReceiptUrl: (tripId: string) => Promise<void>;
  generateReceipt: (tripId: string) => Promise<void>;
  clearReceiptError: (tripId: string) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // ── Initial state ─────────────────────────────────────────
  trips: [],
  total: 0,
  totalPages: 0,
  filters: DEFAULT_FILTERS,
  isLoading: false,
  error: null,
  receiptState: {},

  // ── Filter actions ────────────────────────────────────────
  setFilters: (partial) => {
    set((s) => ({
      filters: {
        ...s.filters,
        ...partial,
        // Reset to page 1 whenever any filter other than page changes
        page: "page" in partial ? (partial.page ?? 1) : 1,
      },
    }));
    // Auto-fetch after filter change
    get().fetchHistory();
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS });
    get().fetchHistory();
  },

  // ── Fetch trip history ────────────────────────────────────
  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    const { filters } = get();

    const params = new URLSearchParams({
      search: filters.search,
      type: filters.type,
      status: filters.status,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
      ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
      ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
    });

    try {
      const res = await fetch(`/history?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data: TripHistoryResponse = await res.json();
      set({
        trips: data.trips,
        total: data.total,
        totalPages: data.totalPages,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Unknown error",
        isLoading: false,
      });
    }
  },

  // ── Receipt: get signed URL for existing receipt ──────────
  fetchReceiptUrl: async (tripId: string) => {
    set((s) => ({
      receiptState: {
        ...s.receiptState,
        [tripId]: { loading: true, url: null, error: null },
      },
    }));

    try {
      const res = await fetch(`/history/${tripId}/receipt`);
      if (!res.ok) throw new Error("Receipt not found");
      const data: { receiptUrl: string } = await res.json();
      set((s) => ({
        receiptState: {
          ...s.receiptState,
          [tripId]: { loading: false, url: data.receiptUrl, error: null },
        },
      }));
    } catch (err) {
      set((s) => ({
        receiptState: {
          ...s.receiptState,
          [tripId]: {
            loading: false,
            url: null,
            error: err instanceof Error ? err.message : "Unknown error",
          },
        },
      }));
    }
  },

  // ── Receipt: generate PDF (POST) then open ────────────────
  generateReceipt: async (tripId: string) => {
    set((s) => ({
      receiptState: {
        ...s.receiptState,
        [tripId]: { loading: true, url: null, error: null },
      },
    }));

    try {
      const res = await fetch(`/history/${tripId}/receipt`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate receipt");
      const data: { receiptUrl: string } = await res.json();

      set((s) => ({
        receiptState: {
          ...s.receiptState,
          [tripId]: { loading: false, url: data.receiptUrl, error: null },
        },
        // Also update the trip record in the list
        trips: s.trips.map((t) =>
          t.id === tripId ? { ...t, receiptUrl: data.receiptUrl } : t
        ),
      }));
    } catch (err) {
      set((s) => ({
        receiptState: {
          ...s.receiptState,
          [tripId]: {
            loading: false,
            url: null,
            error: err instanceof Error ? err.message : "Unknown error",
          },
        },
      }));
    }
  },

  clearReceiptError: (tripId: string) => {
    set((s) => ({
      receiptState: {
        ...s.receiptState,
        [tripId]: { ...(s.receiptState[tripId] ?? {}), error: null },
      },
    }));
  },
}));
