// store/useSubscriptionStore.ts
// Client-side Zustand store for the current user's subscription state.
// Consumed by subscription UI, pricing pages, and feature-gate checks.

import { create } from "zustand";
import type { Subscription, SubscriptionPlan } from "@/types/monetization";

interface SubscriptionState {
  // Data
  currentSubscription: Subscription | null;
  availablePlans: SubscriptionPlan[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlans: (role?: string) => Promise<void>;
  activateSubscription: (
    planId: string,
    paymentRef: string,
    saccoId?: string
  ) => Promise<void>;
  cancelSubscription: (subscriptionId: string, immediate?: boolean) => Promise<void>;

  // Feature gate helpers
  hasActiveSubscription: () => boolean;
  isOnPlan: (slug: string) => boolean;
  getCommissionRate: () => number | null;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  currentSubscription: null,
  availablePlans: [],
  isLoading: false,
  error: null,

  // ── Fetch plans + current subscription ──────────────────────────
  fetchPlans: async (role?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = role ? `?role=${role}` : "";
      const res = await fetch(`/api/monetization/subscriptions${params}`);
      if (!res.ok) throw new Error("Failed to load plans.");
      const { data } = await res.json();
      set({
        availablePlans: data.plans,
        currentSubscription: data.currentSubscription,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  // ── Activate ─────────────────────────────────────────────────────
  activateSubscription: async (planId, paymentRef, saccoId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/monetization/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, paymentRef, saccoId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Activation failed.");
      }
      const { data } = await res.json();
      set({ currentSubscription: data.subscription, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  // ── Cancel ───────────────────────────────────────────────────────
  cancelSubscription: async (subscriptionId, immediate = false) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(
        `/api/monetization/subscriptions/${subscriptionId}?immediate=${immediate}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Cancellation failed.");
      }
      const { data } = await res.json();
      set({ currentSubscription: data.subscription, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
      throw err;
    }
  },

  // ── Feature gate helpers ──────────────────────────────────────────
  hasActiveSubscription: () => {
    const sub = get().currentSubscription;
    return sub?.status === "ACTIVE";
  },

  isOnPlan: (slug: string) => {
    const sub = get().currentSubscription;
    return sub?.status === "ACTIVE" && sub.plan.slug === slug;
  },

  getCommissionRate: () => {
    const sub = get().currentSubscription;
    if (sub?.status === "ACTIVE" && sub.plan.commissionRate != null) {
      return sub.plan.commissionRate;
    }
    return null;
  },
}));
