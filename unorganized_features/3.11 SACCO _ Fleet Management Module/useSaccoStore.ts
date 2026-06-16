// src/store/useSaccoStore.ts
// Zustand store for SACCO / Fleet Management state

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  SaccoStore,
  SaccoOrgDTO,
  SaccoRiderDTO,
  FleetAnalyticsDTO,
  ComplianceRiderDTO,
  SaccoPayoutBatchDTO,
  ZoneDTO,
} from "@/types/sacco";

export const useSaccoStore = create<SaccoStore>()(
  devtools(
    (set) => ({
      // ── Org ─────────────────────────────────────────────────
      sacco: null,
      setSacco: (sacco) => set({ sacco }, false, "setSacco"),

      // ── Riders ──────────────────────────────────────────────
      riders: [],
      ridersLoading: false,
      setRiders: (riders) => set({ riders }, false, "setRiders"),
      setRidersLoading: (v) => set({ ridersLoading: v }, false, "setRidersLoading"),

      // ── Analytics ───────────────────────────────────────────
      analytics: null,
      analyticsLoading: false,
      setAnalytics: (analytics) => set({ analytics }, false, "setAnalytics"),
      setAnalyticsLoading: (v) =>
        set({ analyticsLoading: v }, false, "setAnalyticsLoading"),

      // ── Compliance ──────────────────────────────────────────
      compliance: [],
      complianceLoading: false,
      setCompliance: (compliance) =>
        set({ compliance }, false, "setCompliance"),
      setComplianceLoading: (v) =>
        set({ complianceLoading: v }, false, "setComplianceLoading"),

      // ── Payout batches ──────────────────────────────────────
      payoutBatches: [],
      payoutBatchesLoading: false,
      setPayoutBatches: (payoutBatches) =>
        set({ payoutBatches }, false, "setPayoutBatches"),
      setPayoutBatchesLoading: (v) =>
        set({ payoutBatchesLoading: v }, false, "setPayoutBatchesLoading"),

      // ── Zones ───────────────────────────────────────────────
      zones: [],
      setZones: (zones) => set({ zones }, false, "setZones"),
    }),
    { name: "SaccoStore" }
  )
);
