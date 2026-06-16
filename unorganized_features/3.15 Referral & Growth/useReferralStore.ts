// src/store/useReferralStore.ts
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  ReferralCode,
  ReferralStats,
  Promotion,
  LoyaltyAccount,
  LoyaltyTransaction,
} from "@/types/referral";

interface ReferralState {
  // Referral
  myCode: ReferralCode | null;
  stats: ReferralStats | null;
  isFetchingCode: boolean;

  // Promotions / banners
  promotions: Promotion[];
  dismissedIds: Set<string>;
  isFetchingPromos: boolean;

  // Loyalty
  loyalty: LoyaltyAccount | null;
  loyaltyHistory: LoyaltyTransaction[];
  isFetchingLoyalty: boolean;

  // Actions
  fetchMyCode: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchPromotions: (placement: string) => Promise<void>;
  dismissPromotion: (id: string) => void;
  trackPromoClick: (id: string) => void;
  fetchLoyalty: () => Promise<void>;
}

export const useReferralStore = create<ReferralState>()(
  devtools(
    (set, get) => ({
      myCode: null,
      stats: null,
      isFetchingCode: false,
      promotions: [],
      dismissedIds: new Set(),
      isFetchingPromos: false,
      loyalty: null,
      loyaltyHistory: [],
      isFetchingLoyalty: false,

      fetchMyCode: async () => {
        set({ isFetchingCode: true });
        try {
          const res = await fetch("/api/referral/my-code");
          if (!res.ok) throw new Error("Failed to fetch referral code");
          const data = await res.json();
          set({ myCode: data.code });
        } catch {
          // silent — UI shows skeleton
        } finally {
          set({ isFetchingCode: false });
        }
      },

      fetchStats: async () => {
        try {
          const res = await fetch("/api/referral/stats");
          if (!res.ok) return;
          const data = await res.json();
          set({ stats: data });
        } catch {
          // silent
        }
      },

      fetchPromotions: async (placement) => {
        set({ isFetchingPromos: true });
        try {
          const res = await fetch(`/api/promotions?placement=${placement}`);
          if (!res.ok) return;
          const data = await res.json();
          set({ promotions: data.promotions });
        } catch {
          // silent
        } finally {
          set({ isFetchingPromos: false });
        }
      },

      dismissPromotion: (id) => {
        const { dismissedIds } = get();
        const next = new Set(dismissedIds);
        next.add(id);
        set({ dismissedIds: next });
        // Fire-and-forget: persist dismissal server-side
        fetch(`/api/promotions/${id}/dismiss`, { method: "POST" }).catch(() => {});
      },

      trackPromoClick: (id) => {
        fetch(`/api/promotions/${id}/click`, { method: "POST" }).catch(() => {});
      },

      fetchLoyalty: async () => {
        set({ isFetchingLoyalty: true });
        try {
          const res = await fetch("/api/loyalty");
          if (!res.ok) return;
          const data = await res.json();
          set({ loyalty: data.account, loyaltyHistory: data.history });
        } catch {
          // silent
        } finally {
          set({ isFetchingLoyalty: false });
        }
      },
    }),
    { name: "referral-store" }
  )
);
