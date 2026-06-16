// types/monetization.ts
// Central type definitions for all monetization sub-systems

// ─── Subscription ─────────────────────────────────────────────────

export type PlanTargetRole = "RIDER" | "SACCO" | "CLIENT";
export type BillingCycle = "MONTHLY" | "ANNUAL";
export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
export type InvoiceStatus = "PENDING" | "PAID" | "FAILED" | "VOID";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  targetRole: PlanTargetRole;
  billingCycle: BillingCycle;
  priceKes: number;
  commissionRate?: number;   // decimal, e.g. 0.08 = 8%
  seatLimit?: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  planId: string;
  plan: SubscriptionPlan;
  userId?: string;
  saccoId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  nextRenewalAt: string;
  lastRenewalAt?: string;
  paymentRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInvoice {
  id: string;
  subscriptionId: string;
  amountKes: number;
  periodStart: string;
  periodEnd: string;
  paymentRef?: string;
  status: InvoiceStatus;
  paidAt?: string;
  createdAt: string;
}

// ─── Commission ───────────────────────────────────────────────────

export type CommissionScope = "PLATFORM" | "SACCO" | "SUBSCRIPTION";

export interface CommissionRule {
  id: string;
  name: string;
  scope: CommissionScope;
  riderTier?: string;
  saccoId?: string;
  planId?: string;
  ratePercent: number;
  capKes?: number;
  floorKes?: number;
  validFrom: string;
  validTo?: string;
  isActive: boolean;
}

export interface CommissionResolution {
  ruleId: string;
  ruleName: string;
  scope: CommissionScope;
  ratePercent: number;
  commissionKes: number;
  riderEarnsKes: number;
  tripFareKes: number;
}

// ─── Advertising ──────────────────────────────────────────────────

export type AdAudience = "RIDERS" | "CLIENTS" | "BOTH";
export type AdPlacement = "HOME_BANNER" | "TRIP_COMPLETE" | "RIDER_EARNINGS";
export type AdStatus =
  | "PENDING_REVIEW"
  | "ACTIVE"
  | "PAUSED"
  | "REJECTED"
  | "COMPLETED"
  | "BUDGET_EXHAUSTED";
export type AdEventType = "IMPRESSION" | "CLICK";

export interface AdCampaign {
  id: string;
  advertiserName: string;
  advertiserPhone?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  targetAudience: AdAudience;
  targetZoneIds: string[];
  placement: AdPlacement;
  budgetKes: number;
  spentKes: number;
  costPerImpression?: number;
  costPerClick?: number;
  impressions: number;
  clicks: number;
  status: AdStatus;
  reviewedBy?: string;
  reviewNote?: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdServePayload {
  campaignId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  placement: AdPlacement;
}

// ─── Revenue summary (admin dashboard) ───────────────────────────

export interface MonetizationSummary {
  periodStart: string;
  periodEnd: string;
  commissionRevenueKes: number;
  subscriptionRevenueKes: number;
  adRevenueKes: number;
  totalRevenueKes: number;
  activeSubscriptions: {
    rider: number;
    sacco: number;
    client: number;
  };
  activeCampaigns: number;
}

// ─── API response shapes ──────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
