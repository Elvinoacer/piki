// src/lib/referral/referral.service.ts
// Server-side service — call from Route Handlers / Server Actions only
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import {
  ReferralStatus,
  LOYALTY_POINTS_PER_KES,
  LOYALTY_TIER_THRESHOLDS,
  LoyaltyTier,
} from "@/types/referral";

// ── Referral code generation ──────────────────────────────────────────────────

/** Generate or fetch the referral code for a user. One code per user lifetime. */
export async function getOrCreateReferralCode(
  userId: string,
  role: "CLIENT" | "RIDER"
) {
  const existing = await prisma.referralCode.findFirst({
    where: { ownerId: userId, isActive: true },
  });
  if (existing) return existing;

  // Default bonus config — override via admin settings / env
  const bonusAmount = role === "RIDER" ? 100 : 50; // KES

  return prisma.referralCode.create({
    data: {
      code: generateCode(role),
      ownerId: userId,
      ownerRole: role,
      bonusType: "RIDE_CREDIT",
      bonusAmount,
      currency: "KES",
    },
  });
}

function generateCode(role: "CLIENT" | "RIDER") {
  const prefix = role === "RIDER" ? "RDR" : "CLI";
  return `${prefix}-${nanoid(6).toUpperCase()}`;
}

// ── Redeem referral on sign-up ────────────────────────────────────────────────

export async function redeemReferralCode(refereeId: string, code: string) {
  const referralCode = await prisma.referralCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { owner: { select: { id: true } } },
  });

  if (!referralCode || !referralCode.isActive) {
    return { success: false, error: "Invalid or inactive referral code." };
  }
  if (referralCode.ownerId === refereeId) {
    return { success: false, error: "You cannot use your own referral code." };
  }
  if (referralCode.expiresAt && referralCode.expiresAt < new Date()) {
    return { success: false, error: "This referral code has expired." };
  }
  if (referralCode.maxUses !== null && referralCode.usedCount >= referralCode.maxUses) {
    return { success: false, error: "This referral code has reached its usage limit." };
  }

  const alreadyReferred = await prisma.referralRedemption.findUnique({
    where: { refereeId },
  });
  if (alreadyReferred) {
    return { success: false, error: "You have already used a referral code." };
  }

  const referee = await prisma.user.findUnique({ where: { id: refereeId } });
  if (!referee) return { success: false, error: "User not found." };

  await prisma.$transaction([
    prisma.referralRedemption.create({
      data: {
        referralCodeId: referralCode.id,
        referrerId: referralCode.ownerId,
        refereeId,
        refereeRole: referee.role as "CLIENT" | "RIDER",
        status: "PENDING",
        referrerBonus: referralCode.bonusAmount,
        refereeBonus: referralCode.bonusAmount * 0.5, // referee gets half
      },
    }),
    prisma.referralCode.update({
      where: { id: referralCode.id },
      data: { usedCount: { increment: 1 } },
    }),
  ]);

  return { success: true };
}

// ── Qualify referral after first completed trip ───────────────────────────────

export async function qualifyReferral(refereeId: string, tripId: string) {
  const redemption = await prisma.referralRedemption.findUnique({
    where: { refereeId },
    include: { referralCode: true },
  });

  if (!redemption || redemption.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    // Mark as qualified
    await tx.referralRedemption.update({
      where: { id: redemption.id },
      data: { status: "QUALIFIED", qualifiedAt: new Date() },
    });

    // Credit referee wallet (ride credit)
    await tx.walletTransaction.create({
      data: {
        wallet: { connect: { userId: refereeId } },
        type: "CREDIT",
        amount: redemption.refereeBonus,
        description: "Referral sign-up bonus",
        referenceId: redemption.id,
        referenceType: "REFERRAL",
      },
    });
    await tx.wallet.update({
      where: { userId: refereeId },
      data: { balance: { increment: redemption.refereeBonus } },
    });

    // Credit referrer wallet
    await tx.walletTransaction.create({
      data: {
        wallet: { connect: { userId: redemption.referrerId } },
        type: "CREDIT",
        amount: redemption.referrerBonus,
        description: `Referral reward — new ${redemption.refereeRole.toLowerCase()} joined`,
        referenceId: redemption.id,
        referenceType: "REFERRAL",
      },
    });
    await tx.wallet.update({
      where: { userId: redemption.referrerId },
      data: { balance: { increment: redemption.referrerBonus } },
    });

    // Mark paid
    await tx.referralRedemption.update({
      where: { id: redemption.id },
      data: { status: "PAID", paidOutAt: new Date() },
    });
  });
}

// ── Promo code validation ─────────────────────────────────────────────────────

export async function validatePromoCode(
  code: string,
  userId: string,
  fareAmount: number
) {
  const promo = await prisma.promoCode.findUnique({ where: { code } });

  if (!promo || !promo.isActive) {
    return { valid: false, error: "Invalid or inactive promo code." };
  }
  if (new Date() < promo.startsAt || new Date() > promo.endsAt) {
    return { valid: false, error: "This promo code is not currently active." };
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { valid: false, error: "This promo code has been fully claimed." };
  }
  if (promo.minFare !== null && fareAmount < Number(promo.minFare)) {
    return {
      valid: false,
      error: `Minimum fare of KES ${promo.minFare} required.`,
    };
  }

  const userUseCount = await prisma.promoRedemption.count({
    where: { promoCodeId: promo.id, userId },
  });
  if (userUseCount >= promo.perUserLimit) {
    return { valid: false, error: "You have already used this promo code." };
  }

  const rawDiscount =
    promo.discountType === "PERCENTAGE"
      ? (fareAmount * Number(promo.discountValue)) / 100
      : Number(promo.discountValue);

  const discount =
    promo.maxDiscount !== null
      ? Math.min(rawDiscount, Number(promo.maxDiscount))
      : rawDiscount;

  return { valid: true, promoCode: promo, discount };
}

// ── Loyalty points ────────────────────────────────────────────────────────────

export async function earnLoyaltyPoints(
  userId: string,
  fareKes: number,
  tripId: string
) {
  const points = Math.floor(fareKes * LOYALTY_POINTS_PER_KES);
  if (points <= 0) return;

  await prisma.$transaction(async (tx) => {
    const account = await tx.loyaltyAccount.upsert({
      where: { userId },
      create: { userId, balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0 },
      update: {},
    });

    const newBalance = account.balance + points;
    const newLifetime = account.lifetimeEarned + points;
    const newTier = computeTier(newLifetime);

    await tx.loyaltyAccount.update({
      where: { userId },
      data: {
        balance: newBalance,
        lifetimeEarned: newLifetime,
        tier: newTier,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: "EARN_TRIP",
        points,
        balanceAfter: newBalance,
        description: `Earned for trip`,
        referenceId: tripId,
        referenceType: "TRIP",
      },
    });
  });
}

function computeTier(lifetimePoints: number): LoyaltyTier {
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.PLATINUM) return "PLATINUM";
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.GOLD) return "GOLD";
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.SILVER) return "SILVER";
  return "BRONZE";
}
