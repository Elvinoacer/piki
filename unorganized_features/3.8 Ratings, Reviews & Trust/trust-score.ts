// src/lib/trust-score.ts
// Recomputes a rider's trust score + badge eligibility after each new rating.
// Called from the submitRating server action — keep it pure & testable.

import { prisma } from "@/lib/prisma";
import type { BadgeType } from "@/types/ratings";

const TIER_THRESHOLDS = [
  { tier: 3, minScore: 4.8, minRatings: 100 }, // Gold
  { tier: 2, minScore: 4.5, minRatings: 30 },  // Silver
  { tier: 1, minScore: 0,   minRatings: 0 },   // Standard
] as const;

const STREAK_BADGE_THRESHOLD = 10; // consecutive 5-stars → badge
const TOP_RATED_SCORE = 4.8;
const TOP_RATED_MIN_RATINGS = 50;

/** Recompute and persist trust score + badges for a rider. */
export async function recomputeRiderTrustScore(riderId: string): Promise<void> {
  // 1. Aggregate all ratings received by this rider
  const [agg, recentRatings] = await Promise.all([
    prisma.rating.aggregate({
      where: { toUser: { riderProfile: { id: riderId } }, isVisible: true },
      _avg: { score: true },
      _count: { score: true },
    }),
    // Last 50 ratings ordered newest first — for streak calc
    prisma.rating.findMany({
      where: {
        toUser: { riderProfile: { id: riderId } },
        direction: "CLIENT_TO_RIDER",
        isVisible: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { score: true },
    }),
  ]);

  const averageScore = agg._avg.score ?? 5.0;
  const totalRatings = agg._count.score;

  // 2. Count 5-star and 1-star extremes
  const [fiveStarCount, oneStarCount] = await Promise.all([
    prisma.rating.count({
      where: {
        toUser: { riderProfile: { id: riderId } },
        score: 5,
        isVisible: true,
      },
    }),
    prisma.rating.count({
      where: {
        toUser: { riderProfile: { id: riderId } },
        score: 1,
        isVisible: true,
      },
    }),
  ]);

  // 3. Calculate current consecutive 5-star streak
  let currentStreakCount = 0;
  for (const r of recentRatings) {
    if (r.score === 5) currentStreakCount++;
    else break;
  }

  // 4. Determine tier
  const tierLevel =
    TIER_THRESHOLDS.find(
      (t) => averageScore >= t.minScore && totalRatings >= t.minRatings
    )?.tier ?? 1;

  // 5. Priority score (0–100): weighted blend of avg score, total volume, and streak
  const matchingPriority = Math.min(
    100,
    Math.round(
      (averageScore / 5) * 60 +
        Math.min(totalRatings / 200, 1) * 20 +
        Math.min(currentStreakCount / 20, 1) * 20
    )
  );

  // 6. Upsert trust score row
  const trustScore = await prisma.riderTrustScore.upsert({
    where: { riderId },
    create: {
      riderId,
      averageScore,
      totalRatings,
      fiveStarCount,
      oneStarCount,
      currentStreakCount,
      longestStreak: currentStreakCount,
      matchingPriority,
      tierLevel,
    },
    update: {
      averageScore,
      totalRatings,
      fiveStarCount,
      oneStarCount,
      currentStreakCount,
      longestStreak: { set: Math.max(currentStreakCount, 0) }, // preserve longest
      matchingPriority,
      tierLevel,
    },
  });

  // 7. Sync badges
  await syncBadges(trustScore.id, {
    averageScore,
    totalRatings,
    currentStreakCount,
    riderId,
  });
}

async function syncBadges(
  trustScoreId: string,
  ctx: {
    averageScore: number;
    totalRatings: number;
    currentStreakCount: number;
    riderId: string;
  }
): Promise<void> {
  const earned = new Set<BadgeType>();

  if (ctx.averageScore >= TOP_RATED_SCORE && ctx.totalRatings >= TOP_RATED_MIN_RATINGS) {
    earned.add("TOP_RATED");
  }
  if (ctx.currentStreakCount >= STREAK_BADGE_THRESHOLD) {
    earned.add("FIVE_STAR_STREAK");
  }

  const existing = await prisma.badge.findMany({ where: { trustScoreId } });
  const existingTypes = new Set(existing.map((b) => b.type as BadgeType));

  // Award newly earned badges
  const toAward = [...earned].filter((t) => !existingTypes.has(t));
  for (const type of toAward) {
    await prisma.badge.upsert({
      where: { trustScoreId_type: { trustScoreId, type } },
      create: {
        trustScoreId,
        type,
        label: BADGE_LABEL[type],
        isActive: true,
      },
      update: { isActive: true },
    });
  }

  // Deactivate no-longer-earned badges (excluding VERIFIED + SACCO_CERTIFIED — admin-set)
  const autoTypes: BadgeType[] = ["TOP_RATED", "FIVE_STAR_STREAK"];
  const toLose = autoTypes.filter((t) => existingTypes.has(t) && !earned.has(t));
  if (toLose.length > 0) {
    await prisma.badge.updateMany({
      where: { trustScoreId, type: { in: toLose } },
      data: { isActive: false },
    });
  }
}

const BADGE_LABEL: Record<BadgeType, string> = {
  VERIFIED: "Verified",
  TOP_RATED: "Top Rated",
  FIVE_STAR_STREAK: "5-Star Streak",
  SACCO_CERTIFIED: "SACCO Certified",
};
