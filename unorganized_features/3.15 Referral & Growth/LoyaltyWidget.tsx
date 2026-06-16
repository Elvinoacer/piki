// src/components/referral/LoyaltyWidget.tsx
// Phase 4 - ready but gated via feature flag / env var
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect } from "react";
import { useReferralStore } from "@/store/useReferralStore";
import type { LoyaltyTier } from "@/types/referral";
import { LOYALTY_TIER_THRESHOLDS, LOYALTY_REDEMPTION_RATE } from "@/types/referral";
import { Sparkles } from "lucide-react";

const TIER_COLORS: Record<LoyaltyTier, { bg: string; text: string; bar: string }> = {
  BRONZE: { bg: "#fef3c7", text: "#92400e", bar: "#d97706" },
  SILVER: { bg: "#f1f5f9", text: "#475569", bar: "#94a3b8" },
  GOLD: { bg: "#fefce8", text: "#713f12", bar: "#eab308" },
  PLATINUM: { bg: "#f0f9ff", text: "#075985", bar: "#38bdf8" },
};

const TIER_ORDER: LoyaltyTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

export function LoyaltyWidget() {
  const { loyalty, isFetchingLoyalty, fetchLoyalty } = useReferralStore();

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  if (isFetchingLoyalty) {
    return <div className="lw-skeleton" aria-label="Loading loyalty info…" />;
  }

  if (!loyalty) {
    // Show empty state — account created on first trip completion
    return (
      <div className="lw-empty">
        <Sparkles size={22} aria-hidden />
        <p>
          Complete your first ride to start earning <strong>Pikii Points</strong>.
        </p>
        <style>{css}</style>
      </div>
    );
  }

  const tier = loyalty.tier as LoyaltyTier;
  const colors = TIER_COLORS[tier];
  const tierIndex = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIndex + 1] as LoyaltyTier | undefined;
  const nextThreshold = nextTier ? LOYALTY_TIER_THRESHOLDS[nextTier] : null;
  const currentThreshold = LOYALTY_TIER_THRESHOLDS[tier];
  const progressMax = nextThreshold
    ? nextThreshold - currentThreshold
    : LOYALTY_TIER_THRESHOLDS.PLATINUM;
  const progressCurrent = nextThreshold
    ? Math.min(loyalty.lifetimeEarned - currentThreshold, progressMax)
    : progressMax;
  const pct = Math.min(100, (progressCurrent / progressMax) * 100);
  const valueKes = (loyalty.balance * LOYALTY_REDEMPTION_RATE).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="lw-card" style={{ background: colors.bg }}>
      {/* Tier badge */}
      <div className="lw-top">
        <div>
          <span className="lw-tier-label" style={{ color: colors.text }}>
            <Sparkles size={13} aria-hidden />
            {tier} member
          </span>
          <p className="lw-pts">{loyalty.balance.toLocaleString()} pts</p>
          <p className="lw-value" style={{ color: colors.text }}>
            ≈ KES {valueKes}
          </p>
        </div>
        <div className="lw-badge" style={{ background: colors.bar }} aria-hidden>
          {tier[0]}
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <div className="lw-progress-wrap" aria-label={`Progress to ${nextTier} tier`}>
          <div className="lw-bar-bg">
            <div
              className="lw-bar-fill"
              style={{ width: `${pct}%`, background: colors.bar }}
              role="progressbar"
              aria-valuenow={progressCurrent}
              aria-valuemin={0}
              aria-valuemax={progressMax}
            />
          </div>
          <p className="lw-progress-label" style={{ color: colors.text }}>
            {(progressMax - progressCurrent).toLocaleString()} pts to {nextTier}
          </p>
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .lw-skeleton {
    height: 112px;
    border-radius: 14px;
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
  }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .lw-empty {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 14px;
    background: var(--color-surface-alt, #f9fafb);
    color: var(--color-text-muted, #6b7280);
    font-size: 0.85rem;
  }
  .lw-card {
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .lw-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .lw-tier-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }
  .lw-pts {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--color-text, #111827);
    margin: 0 0 2px;
    line-height: 1;
  }
  .lw-value { font-size: 0.78rem; margin: 0; opacity: 0.8; }
  .lw-badge {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: #fff;
    font-size: 1.2rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .lw-progress-wrap { display: flex; flex-direction: column; gap: 5px; }
  .lw-bar-bg {
    height: 6px;
    border-radius: 99px;
    background: rgba(0,0,0,0.12);
    overflow: hidden;
  }
  .lw-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.5s ease;
  }
  .lw-progress-label { font-size: 0.72rem; margin: 0; opacity: 0.75; }
`;
