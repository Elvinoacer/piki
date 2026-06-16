// lib/monetization/subscription-service.ts
// All subscription lifecycle logic: create, renew, cancel, status checks.

import { prisma } from "@/lib/prisma";
import type { Subscription, SubscriptionPlan } from "@/types/monetization";
import { addMonths, addYears } from "date-fns";

// ─── Activate / Create ────────────────────────────────────────────

interface ActivateParams {
  planId: string;
  userId?: string;
  saccoId?: string;
  paymentRef: string;
}

/**
 * Creates or upgrades a subscription for a user or SACCO.
 * If the user already has an active subscription on a different plan,
 * it is cancelled and the new one starts immediately.
 */
export async function activateSubscription(
  params: ActivateParams
): Promise<Subscription> {
  const { planId, userId, saccoId, paymentRef } = params;

  if (!userId && !saccoId) {
    throw new Error("Either userId or saccoId must be provided.");
  }

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { id: planId },
  });

  const now = new Date();
  const periodEnd =
    plan.billingCycle === "ANNUAL" ? addYears(now, 1) : addMonths(now, 1);

  // Cancel any existing active subscription
  if (userId) {
    await prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }
  if (saccoId) {
    await prisma.subscription.updateMany({
      where: { saccoId, status: "ACTIVE" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }

  const subscription = await prisma.subscription.create({
    data: {
      planId,
      userId: userId ?? null,
      saccoId: saccoId ?? null,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
      lastRenewalAt: now,
      paymentRef,
      invoices: {
        create: {
          amountKes: plan.priceKes,
          periodStart: now,
          periodEnd,
          paymentRef,
          status: "PAID",
          paidAt: now,
        },
      },
    },
    include: { plan: true, invoices: true },
  });

  return serializeSubscription(subscription);
}

// ─── Renew ────────────────────────────────────────────────────────

/**
 * Called by the BullMQ renewal job when nextRenewalAt is reached.
 * In production this kicks off an M-Pesa STK push; here we record the renewal.
 */
export async function renewSubscription(
  subscriptionId: string,
  paymentRef: string
): Promise<Subscription> {
  const existing = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  const now = new Date();
  const newPeriodEnd =
    existing.plan.billingCycle === "ANNUAL"
      ? addYears(existing.currentPeriodEnd, 1)
      : addMonths(existing.currentPeriodEnd, 1);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      currentPeriodStart: existing.currentPeriodEnd,
      currentPeriodEnd: newPeriodEnd,
      nextRenewalAt: newPeriodEnd,
      lastRenewalAt: now,
      paymentRef,
      invoices: {
        create: {
          amountKes: existing.plan.priceKes,
          periodStart: existing.currentPeriodEnd,
          periodEnd: newPeriodEnd,
          paymentRef,
          status: "PAID",
          paidAt: now,
        },
      },
    },
    include: { plan: true },
  });

  return serializeSubscription(updated);
}

// ─── Cancel ───────────────────────────────────────────────────────

/**
 * Cancels at period end (default) or immediately.
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediate = false
): Promise<Subscription> {
  const now = new Date();

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      cancelAtPeriodEnd: !immediate,
      status: immediate ? "CANCELLED" : "ACTIVE",
      cancelledAt: immediate ? now : null,
    },
    include: { plan: true },
  });

  return serializeSubscription(updated);
}

// ─── Queries ──────────────────────────────────────────────────────

export async function getActiveSubscription(
  userId: string
): Promise<Subscription | null> {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      currentPeriodEnd: { gte: new Date() },
    },
    include: { plan: true },
  });
  return sub ? serializeSubscription(sub) : null;
}

export async function listPlans(
  targetRole?: string
): Promise<SubscriptionPlan[]> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
      ...(targetRole ? { targetRole: targetRole as any } : {}),
    },
    orderBy: [{ targetRole: "asc" }, { priceKes: "asc" }],
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    targetRole: p.targetRole as any,
    billingCycle: p.billingCycle as any,
    priceKes: Number(p.priceKes),
    commissionRate: p.commissionRate ? Number(p.commissionRate) : undefined,
    seatLimit: p.seatLimit ?? undefined,
    features: p.features as string[],
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

// ─── Serialise helper ─────────────────────────────────────────────

function serializeSubscription(s: any): Subscription {
  return {
    id: s.id,
    planId: s.planId,
    plan: {
      id: s.plan.id,
      name: s.plan.name,
      slug: s.plan.slug,
      targetRole: s.plan.targetRole,
      billingCycle: s.plan.billingCycle,
      priceKes: Number(s.plan.priceKes),
      commissionRate: s.plan.commissionRate
        ? Number(s.plan.commissionRate)
        : undefined,
      seatLimit: s.plan.seatLimit ?? undefined,
      features: s.plan.features as string[],
      isActive: s.plan.isActive,
      createdAt: s.plan.createdAt.toISOString(),
      updatedAt: s.plan.updatedAt.toISOString(),
    },
    userId: s.userId ?? undefined,
    saccoId: s.saccoId ?? undefined,
    status: s.status,
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    cancelledAt: s.cancelledAt?.toISOString(),
    nextRenewalAt: s.nextRenewalAt.toISOString(),
    lastRenewalAt: s.lastRenewalAt?.toISOString(),
    paymentRef: s.paymentRef ?? undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
