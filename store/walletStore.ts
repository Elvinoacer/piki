// store/walletStore.ts
// Zustand store for wallet balance and ledger (client + rider)

import { create } from "zustand";
import { LedgerEntry, WalletBalance } from "@/types/payments";

interface WalletState {
  balance: WalletBalance | null;
  ledger: LedgerEntry[];
  ledgerPage: number;
  ledgerTotal: number;
  isLoadingBalance: boolean;
  isLoadingLedger: boolean;
  topUpLoading: boolean;
  payoutLoading: boolean;
  error: string | null;

  // Actions
  fetchBalance: () => Promise<void>;
  fetchLedger: (page?: number) => Promise<void>;
  topUp: (amount: number, phone: string) => Promise<{ checkoutRequestId?: string } | null>;
  requestPayout: (amount: number, phone?: string) => Promise<{ payoutId?: string; message?: string } | null>;
  payFromWallet: (tripId: string, tipAmount?: number) => Promise<boolean>;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: null,
  ledger: [],
  ledgerPage: 1,
  ledgerTotal: 0,
  isLoadingBalance: false,
  isLoadingLedger: false,
  topUpLoading: false,
  payoutLoading: false,
  error: null,

  fetchBalance: async () => {
    set({ isLoadingBalance: true, error: null });
    try {
      const res = await fetch("/api/payments/wallet");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch balance");
      set({ balance: data.balance });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : "Failed to fetch balance" });
    } finally {
      set({ isLoadingBalance: false });
    }
  },

  fetchLedger: async (page = 1) => {
    set({ isLoadingLedger: true, error: null });
    try {
      const res = await fetch(`/api/payments/wallet?page=${page}&pageSize=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch ledger");
      set({
        ledger: data.ledger.transactions,
        ledgerPage: page,
        ledgerTotal: data.ledger.pagination.total,
      });
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : "Failed to fetch ledger" });
    } finally {
      set({ isLoadingLedger: false });
    }
  },

  topUp: async (amount, phone) => {
    set({ topUpLoading: true, error: null });
    try {
      const res = await fetch("/api/payments/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Top-up failed");
      return { checkoutRequestId: data.checkoutRequestId };
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : "Top-up failed" });
      return null;
    } finally {
      set({ topUpLoading: false });
    }
  },

  requestPayout: async (amount, phone) => {
    set({ payoutLoading: true, error: null });
    try {
      const res = await fetch("/api/payments/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payout failed");
      // Refresh balance after successful request
      await get().fetchBalance();
      return { payoutId: data.payoutId, message: data.message };
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : "Payout failed" });
      return null;
    } finally {
      set({ payoutLoading: false });
    }
  },

  payFromWallet: async (tripId, tipAmount = 0) => {
    set({ error: null });
    try {
      const res = await fetch("/api/payments/wallet/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, tipAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      await get().fetchBalance();
      return true;
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : "Payment failed" });
      return false;
    }
  },

  reset: () =>
    set({
      balance: null,
      ledger: [],
      ledgerPage: 1,
      ledgerTotal: 0,
      error: null,
    }),
}));
