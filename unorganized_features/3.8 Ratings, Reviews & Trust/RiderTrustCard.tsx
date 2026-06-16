"use client";
// src/components/ratings/RiderTrustCard.tsx
// Shows rider average score, tier, active badges, and rating breakdown.
// Used in: trip request card (compact), rider profile page (full).

import { useEffect } from "react";
import { StarRating } from "./StarRating";
import { BadgeChip } from "./BadgeChip";
import { useRatingsStore } from "@/store/useRatingsStore";
import type { BadgeType } from "@/types/ratings";

interface RiderTrustCardProps {
  riderId: string;
  variant?: "compact" | "full";
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Standard", color: "text-neutral-500" },
  2: { label: "Silver", color: "text-slate-500" },
  3: { label: "Gold", color: "text-amber-600" },
};

export function RiderTrustCard({ riderId, variant = "compact" }: RiderTrustCardProps) {
  const { trustScoreCache, fetchTrustScore } = useRatingsStore();
  const trust = trustScoreCache[riderId];

  useEffect(() => {
    if (!trust) fetchTrustScore(riderId);
  }, [riderId, trust, fetchTrustScore]);

  if (!trust) {
    return (
      <div className="animate-pulse flex gap-2 items-center">
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-700 rounded" />
        <div className="h-4 w-16 bg-neutral-200 dark:bg-neutral-700 rounded" />
      </div>
    );
  }

  const activeBadges = trust.badges.filter((b) => b.isActive);
  const tier = TIER_LABELS[trust.tierLevel] ?? TIER_LABELS[1];

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <StarRating value={trust.averageScore} readonly size="sm" />
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {trust.totalRatings > 0
              ? trust.averageScore.toFixed(1)
              : "New"}
          </span>
          {trust.totalRatings > 0 && (
            <span className="text-xs text-neutral-400">({trust.totalRatings})</span>
          )}
        </div>
        {activeBadges.slice(0, 2).map((b) => (
          <BadgeChip key={b.type} type={b.type as BadgeType} size="sm" />
        ))}
      </div>
    );
  }

  // Full variant
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-4">
      {/* Score headline */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-neutral-900 dark:text-white">
            {trust.totalRatings > 0 ? trust.averageScore.toFixed(1) : "—"}
          </p>
          <StarRating value={trust.averageScore} readonly size="sm" className="mt-1" />
          <p className="text-xs text-neutral-400 mt-0.5">
            {trust.totalRatings} rating{trust.totalRatings !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex-1 space-y-1">
          <StatBar label="5 ★" count={trust.totalRatings > 0 ? undefined : 0} pct={trust.totalRatings > 0 ? (trust.fiveStarCount ?? 0) / trust.totalRatings : 0} />
          <StatBar label="4 ★" pct={0} dimmed />
          <StatBar label="≤3 ★" count={trust.oneStarCount} pct={trust.totalRatings > 0 ? (trust.oneStarCount ?? 0) / trust.totalRatings : 0} danger />
        </div>
      </div>

      {/* Tier + streak */}
      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-neutral-400 text-xs">Tier</p>
          <p className={`font-semibold ${tier.color}`}>{tier.label}</p>
        </div>
        {trust.currentStreakCount > 0 && (
          <div>
            <p className="text-neutral-400 text-xs">Current streak</p>
            <p className="font-semibold text-purple-600 dark:text-purple-400">
              ⚡ {trust.currentStreakCount} trips
            </p>
          </div>
        )}
      </div>

      {/* Badges */}
      {activeBadges.length > 0 && (
        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
            Badges
          </p>
          <div className="flex flex-wrap gap-2">
            {activeBadges.map((b) => (
              <BadgeChip key={b.type} type={b.type as BadgeType} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBar({
  label,
  pct,
  count,
  dimmed,
  danger,
}: {
  label: string;
  pct: number;
  count?: number;
  dimmed?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-neutral-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            dimmed
              ? "bg-neutral-300 dark:bg-neutral-600"
              : danger
              ? "bg-red-400"
              : "bg-amber-400"
          }`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      {count !== undefined && (
        <span className="w-5 text-right text-neutral-400">{count}</span>
      )}
    </div>
  );
}
