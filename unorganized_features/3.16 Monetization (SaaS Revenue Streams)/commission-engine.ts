// lib/monetization/commission-engine.ts
// Resolves the correct commission rate for a completed trip.
// Priority: SUBSCRIPTION override → SACCO rule → PLATFORM default.

import { prisma } from "@/lib/prisma";
import type { CommissionResolution } from "@/types/monetization";

interface ResolutionInput {
  riderId: string;
  saccoId?: string | null;
  tripFareKes: number;
}

/**
 * Resolves the applicable commission rule for a rider on a given trip fare.
 * Returns a full breakdown so the caller can write ledger entries.
 */
export async function resolveCommission(
  input: ResolutionInput
): Promise<CommissionResolution> {
  const { riderId, saccoId, tripFareKes } = input;

  // 1. Check for active subscription override (rider has Pikii Pro)
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      userId: riderId,
      status: "ACTIVE",
      currentPeriodEnd: { gte: new Date() },
    },
    include: { plan: true },
  });

  if (activeSubscription?.plan.commissionRate != null) {
    const ratePercent = Number(activeSubscription.plan.commissionRate) * 100;
    return buildResolution({
      ruleId: activeSubscription.planId,
      ruleName: activeSubscription.plan.name,
      scope: "SUBSCRIPTION",
      ratePercent,
      capKes: undefined,
      floorKes: undefined,
      tripFareKes,
    });
  }

  // 2. Check for SACCO-specific rule
  if (saccoId) {
    const saccoRule = await prisma.commissionRule.findFirst({
      where: {
        scope: "SACCO",
        saccoId,
        isActive: true,
        validFrom: { lte: new Date() },
        OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
      },
      orderBy: { validFrom: "desc" },
    });

    if (saccoRule) {
      return buildResolution({
        ruleId: saccoRule.id,
        ruleName: saccoRule.name,
        scope: "SACCO",
        ratePercent: Number(saccoRule.ratePercent),
        capKes: saccoRule.capKes ? Number(saccoRule.capKes) : undefined,
        floorKes: saccoRule.floorKes ? Number(saccoRule.floorKes) : undefined,
        tripFareKes,
      });
    }
  }

  // 3. Fall back to platform default
  const platformRule = await prisma.commissionRule.findFirst({
    where: {
      scope: "PLATFORM",
      isActive: true,
      validFrom: { lte: new Date() },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: { validFrom: "desc" },
  });

  if (!platformRule) {
    // Hard-coded fallback if no rule in DB (should not happen after seeding)
    const DEFAULT_RATE = 12;
    const commissionKes = (DEFAULT_RATE / 100) * tripFareKes;
    return {
      ruleId: "default",
      ruleName: "Platform Default (hardcoded)",
      scope: "PLATFORM",
      ratePercent: DEFAULT_RATE,
      commissionKes,
      riderEarnsKes: tripFareKes - commissionKes,
      tripFareKes,
    };
  }

  return buildResolution({
    ruleId: platformRule.id,
    ruleName: platformRule.name,
    scope: "PLATFORM",
    ratePercent: Number(platformRule.ratePercent),
    capKes: platformRule.capKes ? Number(platformRule.capKes) : undefined,
    floorKes: platformRule.floorKes ? Number(platformRule.floorKes) : undefined,
    tripFareKes,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────

interface BuildInput {
  ruleId: string;
  ruleName: string;
  scope: "PLATFORM" | "SACCO" | "SUBSCRIPTION";
  ratePercent: number;
  capKes?: number;
  floorKes?: number;
  tripFareKes: number;
}

function buildResolution(input: BuildInput): CommissionResolution {
  const { ruleId, ruleName, scope, ratePercent, capKes, floorKes, tripFareKes } = input;

  let commissionKes = (ratePercent / 100) * tripFareKes;

  // Apply cap and floor
  if (capKes !== undefined) commissionKes = Math.min(commissionKes, capKes);
  if (floorKes !== undefined) commissionKes = Math.max(commissionKes, floorKes);

  // Round to nearest KES cent
  commissionKes = Math.round(commissionKes * 100) / 100;

  return {
    ruleId,
    ruleName,
    scope,
    ratePercent,
    commissionKes,
    riderEarnsKes: Math.round((tripFareKes - commissionKes) * 100) / 100,
    tripFareKes,
  };
}
