// src/types/referral.ts
// ─────────────────────────────────────────────────────────────────────────────

export type ReferralBonusType = "RIDE_CREDIT" | "CASH_BONUS" | "DISCOUNT";
export type ReferralStatus = "PENDING" | "QUALIFIED" | "PAID" | "EXPIRED" | "CANCELLED";
export type PromotionTarget = "ALL" | "CLIENT" | "RIDER";
export type BannerPlacement = "HOME" | "BOOKING" | "PAYMENT" | "EARNINGS" | "PROFILE";
export type DiscountType = "PERCENTAGE" | "FLAT";
export type LoyaltyTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
export type LoyaltyTxType =
  | "EARN_TRIP"
  | "EARN_REFERRAL"
  | "EARN_BONUS"
  | "REDEEM_DISCOUNT"
  | "EXPIRE"
  | "ADJUST";

// ── Referral ──────────────────────────────────────────────────────────────────

export interface ReferralCode {
  id: string;
  code: string;
  ownerId: string;
  ownerRole: "CLIENT" | "RIDER";
  bonusType: ReferralBonusType;
  bonusAmount: number;
  currency: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ReferralRedemption {
  id: string;
  referralCodeId: string;
  referrerId: string;
  refereeId: string;
  refereeRole: "CLIENT" | "RIDER";
  status: ReferralStatus;
  referrerBonus: number;
  refereeBonus: number;
  qualifiedAt: string | null;
  paidOutAt: string | null;
  createdAt: string;
  referee?: {
    id: string;
    name: string;
    phone: string;
    avatarUrl?: string;
  };
}

export interface ReferralStats {
  totalReferrals: number;
  qualifiedReferrals: number;
  paidReferrals: number;
  totalEarned: number;
  pendingEarnings: number;
  code: string;
}

// ── Promotions ────────────────────────────────────────────────────────────────

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  targetRole: PromotionTarget;
  placement: BannerPlacement;
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  promoCodeId: string | null;
  promoCode?: {
    code: string;
    discountType: DiscountType;
    discountValue: number;
  };
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface CreatePromotionInput {
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  targetRole: PromotionTarget;
  placement: BannerPlacement;
  priority?: number;
  startsAt: string;
  endsAt: string;
  promoCodeId?: string;
}

// ── PromoCode ─────────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  minFare: number | null;
  maxDiscount: number | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  targetRole: PromotionTarget;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface ValidatePromoCodeResult {
  valid: boolean;
  promoCode?: PromoCode;
  discount?: number; // computed KES amount
  error?: string;
}

// ── Loyalty ───────────────────────────────────────────────────────────────────

export interface LoyaltyAccount {
  id: string;
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: LoyaltyTier;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  type: LoyaltyTxType;
  points: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  BRONZE: 0,
  SILVER: 500,
  GOLD: 2000,
  PLATINUM: 5000,
};

export const LOYALTY_POINTS_PER_KES = 0.1; // 1 point per KES 10 spent
export const LOYALTY_REDEMPTION_RATE = 0.5; // 1 point = KES 0.50 off
