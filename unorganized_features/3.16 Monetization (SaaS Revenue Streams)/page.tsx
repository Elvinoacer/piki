"use client";
// app/(dashboard)/admin/monetization/page.tsx
// Admin monetization overview: revenue summary, subscription counts,
// commission rules, and ad campaign management.

import { useEffect, useState } from "react";
import { prisma } from "@/lib/prisma";
import type { MonetizationSummary, AdCampaign, CommissionRule } from "@/types/monetization";

// ─── This page is a Server Component wrapper that fetches summary data ──────
// The heavy lifting is done server-side; client components handle interactions.

import MonetizationSummaryCards from "./_components/MonetizationSummaryCards";
import CommissionRulesTable from "./_components/CommissionRulesTable";
import AdCampaignsTable from "./_components/AdCampaignsTable";
import SubscriptionBreakdownChart from "./_components/SubscriptionBreakdownChart";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getMonetizationSummary(): Promise<MonetizationSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    commissionTotal,
    subRevenueTotal,
    adRevenueTotal,
    riderSubs,
    saccoSubs,
    clientSubs,
    activeCampaigns,
  ] = await Promise.all([
    // Commission this month — sum of DEBIT wallet transactions with COMMISSION_ reference
    prisma.walletTransaction.aggregate({
      where: {
        type: "DEBIT",
        reference: { startsWith: "COMMISSION_" },
        createdAt: { gte: monthStart },
      },
      _sum: { amountKes: true },
    }),
    // Subscription revenue this month — paid invoices
    prisma.subscriptionInvoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { amountKes: true },
    }),
    // Ad revenue this month — total spent across campaigns
    prisma.adCampaign.aggregate({
      where: { updatedAt: { gte: monthStart } },
      _sum: { spentKes: true },
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", plan: { targetRole: "RIDER" } },
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", plan: { targetRole: "SACCO" } },
    }),
    prisma.subscription.count({
      where: { status: "ACTIVE", plan: { targetRole: "CLIENT" } },
    }),
    prisma.adCampaign.count({ where: { status: "ACTIVE" } }),
  ]);

  const commissionKes = Number(commissionTotal._sum.amountKes ?? 0);
  const subKes = Number(subRevenueTotal._sum.amountKes ?? 0);
  const adKes = Number(adRevenueTotal._sum.spentKes ?? 0);

  return {
    periodStart: monthStart.toISOString(),
    periodEnd: now.toISOString(),
    commissionRevenueKes: commissionKes,
    subscriptionRevenueKes: subKes,
    adRevenueKes: adKes,
    totalRevenueKes: commissionKes + subKes + adKes,
    activeSubscriptions: { rider: riderSubs, sacco: saccoSubs, client: clientSubs },
    activeCampaigns,
  };
}

async function getCommissionRules(): Promise<CommissionRule[]> {
  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true },
    orderBy: [{ scope: "asc" }, { validFrom: "desc" }],
    take: 20,
  });
  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope as any,
    riderTier: r.riderTier ?? undefined,
    saccoId: r.saccoId ?? undefined,
    planId: r.planId ?? undefined,
    ratePercent: Number(r.ratePercent),
    capKes: r.capKes ? Number(r.capKes) : undefined,
    floorKes: r.floorKes ? Number(r.floorKes) : undefined,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo?.toISOString(),
    isActive: r.isActive,
  }));
}

async function getAdCampaigns(): Promise<AdCampaign[]> {
  const campaigns = await prisma.adCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return campaigns.map((c) => ({
    id: c.id,
    advertiserName: c.advertiserName,
    advertiserPhone: c.advertiserPhone ?? undefined,
    title: c.title,
    description: c.description ?? undefined,
    imageUrl: c.imageUrl ?? undefined,
    ctaLabel: c.ctaLabel ?? undefined,
    ctaUrl: c.ctaUrl ?? undefined,
    targetAudience: c.targetAudience as any,
    targetZoneIds: c.targetZoneIds,
    placement: c.placement as any,
    budgetKes: Number(c.budgetKes),
    spentKes: Number(c.spentKes),
    costPerImpression: c.costPerImpression ? Number(c.costPerImpression) : undefined,
    costPerClick: c.costPerClick ? Number(c.costPerClick) : undefined,
    impressions: c.impressions,
    clicks: c.clicks,
    status: c.status as any,
    reviewedBy: c.reviewedBy ?? undefined,
    reviewNote: c.reviewNote ?? undefined,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

// ─── Page (Server Component) ──────────────────────────────────────
export default async function MonetizationPage() {
  const [summary, commissionRules, adCampaigns] = await Promise.all([
    getMonetizationSummary(),
    getCommissionRules(),
    getAdCampaigns(),
  ]);

  return (
    <div className="p-6 space-y-8 max-w-screen-xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Monetization</h1>
        <p className="text-sm text-gray-500 mt-1">
          Revenue overview for{" "}
          {new Date(summary.periodStart).toLocaleString("en-KE", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* KPI cards */}
      <MonetizationSummaryCards summary={summary} />

      {/* Subscription breakdown */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">
          Active Subscriptions
        </h2>
        <SubscriptionBreakdownChart summary={summary} />
      </section>

      {/* Commission rules */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">
          Commission Rules
        </h2>
        <CommissionRulesTable rules={commissionRules} />
      </section>

      {/* Ad campaigns */}
      <section>
        <h2 className="text-lg font-medium text-gray-800 mb-4">
          Ad Campaigns
        </h2>
        <AdCampaignsTable campaigns={adCampaigns} />
      </section>
    </div>
  );
}
