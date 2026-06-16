// lib/payments/commission.ts
// Commission auto-deduction engine
// Configurable per rider tier / SACCO

import { prisma } from "@/lib/prisma";
import { FareBreakdown, CommissionConfig } from "@/types/payments";

// ----------------------------------------------------------------
// Default commission rates (fallback when no SACCO/tier config)
// ----------------------------------------------------------------
const DEFAULT_COMMISSION_RATE = 0.12; // 12%
const MIN_COMMISSIONABLE_FARE = 50;   // KES — below this no commission

// ----------------------------------------------------------------
// Resolve commission rate for a rider
// Checks: rider tier override → SACCO rate → platform default
// ----------------------------------------------------------------
export async function resolveCommissionRate(riderId: string): Promise<number> {
  const riderProfile = await prisma.riderProfile.findUnique({
    where: { userId: riderId },
    include: { sacco: true },
  });

  if (!riderProfile) return DEFAULT_COMMISSION_RATE;

  // Tier override (e.g. Pikii Pro subscriber pays 8%)
  if (riderProfile.commissionRateOverride !== null) {
    return Number(riderProfile.commissionRateOverride);
  }

  // SACCO-level rate
  if (riderProfile.sacco?.commissionRate !== null) {
    return Number(riderProfile.sacco?.commissionRate);
  }

  return DEFAULT_COMMISSION_RATE;
}

// ----------------------------------------------------------------
// Calculate fare breakdown with commission
// ----------------------------------------------------------------
export async function calculateFareBreakdown(
  riderId: string,
  tripFare: number,
  tipAmount = 0
): Promise<FareBreakdown> {
  const rate = await resolveCommissionRate(riderId);
  const commissionable = Math.max(0, tripFare - MIN_COMMISSIONABLE_FARE);
  const commission =
    tripFare >= MIN_COMMISSIONABLE_FARE
      ? parseFloat((tripFare * rate).toFixed(2))
      : 0;
  const riderEarning = parseFloat((tripFare - commission + tipAmount).toFixed(2));

  return {
    baseFare: tripFare,
    tripFare,
    tip: tipAmount,
    commissionRate: rate,
    commissionAmount: commission,
    riderEarning,
    total: tripFare + tipAmount,
  };
}

// ----------------------------------------------------------------
// Apply commission after a cash trip
// (rider owes commission — deducted from wallet, or queued as debt)
// ----------------------------------------------------------------
export async function applyCashTripCommission(
  riderId: string,
  tripId: string,
  tripFare: number
): Promise<void> {
  const breakdown = await calculateFareBreakdown(riderId, tripFare);

  if (breakdown.commissionAmount <= 0) return;

  const { debitWallet, creditWallet } = await import("./wallet");

  try {
    // Attempt direct debit from rider wallet
    await debitWallet({
      userId: riderId,
      amount: breakdown.commissionAmount,
      reason: "COMMISSION_DEDUCTION",
      referenceId: tripId,
      description: `Commission (${(breakdown.commissionRate * 100).toFixed(0)}%) for trip ${tripId}`,
      metadata: { tripId, commissionRate: breakdown.commissionRate, tripFare },
    });
  } catch (err: unknown) {
    // Insufficient balance — record as a debt flag on the trip for admin reconciliation
    const message = err instanceof Error ? err.message : String(err);
    await prisma.payment.update({
      where: { tripId },
      data: {
        metadata: {
          commissionDebt: breakdown.commissionAmount,
          commissionDebtReason: message,
        },
      },
    });
    console.warn(
      `[Commission] Rider ${riderId} has insufficient balance for commission on trip ${tripId}. Flagged for reconciliation.`
    );
  }
}

// ----------------------------------------------------------------
// Apply commission after a digital payment (wallet/mpesa)
// ----------------------------------------------------------------
export async function applyDigitalTripCommission(
  riderId: string,
  tripId: string,
  breakdown: FareBreakdown
): Promise<void> {
  const { creditWallet } = await import("./wallet");

  if (breakdown.commissionAmount <= 0) {
    // No commission — credit full fare to rider
    await creditWallet({
      userId: riderId,
      amount: breakdown.riderEarning,
      reason: "TRIP_EARNING",
      referenceId: tripId,
      description: `Earnings for trip ${tripId}`,
    });
    return;
  }

  // Credit rider only their net earning (fare minus commission)
  await creditWallet({
    userId: riderId,
    amount: breakdown.riderEarning,
    reason: "TRIP_EARNING",
    referenceId: tripId,
    description: `Trip earnings after ${(breakdown.commissionRate * 100).toFixed(0)}% commission`,
    metadata: { tripId, breakdown },
  });

  // Commission stays on platform — no separate transfer needed in this model
  // (Platform wallet or revenue account tracked via WalletTransaction audit)
}
