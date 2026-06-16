// lib/monetization/ad-service.ts
// Serves the right ad for a placement + audience, records impression/click events,
// and deducts spend from campaign budget.

import { prisma } from "@/lib/prisma";
import type { AdServePayload, AdAudience, AdPlacement } from "@/types/monetization";

interface ServeParams {
  placement: AdPlacement;
  audience: AdAudience;
  zoneId?: string;
  userId?: string;
}

/**
 * Returns the highest-priority active ad for a given placement/audience.
 * Priority: zone-targeted campaigns over global; highest remaining budget.
 * Records an IMPRESSION event and deducts cost.
 */
export async function serveAd(
  params: ServeParams
): Promise<AdServePayload | null> {
  const { placement, audience, zoneId, userId } = params;

  const now = new Date();

  // Find eligible campaigns
  const candidates = await prisma.adCampaign.findMany({
    where: {
      placement,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gte: now },
      spentKes: { lt: prisma.adCampaign.fields.budgetKes }, // has budget remaining (filtered below)
      targetAudience: {
        in: audience === "RIDERS" ? ["RIDERS", "BOTH"] : ["CLIENTS", "BOTH"],
      },
    },
    orderBy: { spentKes: "asc" }, // rough fairness: least-spent first
  });

  if (candidates.length === 0) return null;

  // Filter: budget not exhausted; prefer zone-targeted
  const eligible = candidates.filter(
    (c) => Number(c.spentKes) < Number(c.budgetKes)
  );
  if (eligible.length === 0) return null;

  const zoneTargeted = zoneId
    ? eligible.filter(
        (c) => c.targetZoneIds.length === 0 || c.targetZoneIds.includes(zoneId)
      )
    : eligible;

  const campaign = zoneTargeted.length > 0 ? zoneTargeted[0] : eligible[0];

  // Record impression + deduct cost
  const cpi = campaign.costPerImpression ? Number(campaign.costPerImpression) : 0;

  await prisma.$transaction([
    prisma.adEvent.create({
      data: {
        campaignId: campaign.id,
        userId: userId ?? null,
        eventType: "IMPRESSION",
        zoneId: zoneId ?? null,
      },
    }),
    prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        impressions: { increment: 1 },
        spentKes: { increment: cpi },
      },
    }),
  ]);

  return {
    campaignId: campaign.id,
    title: campaign.title,
    description: campaign.description ?? undefined,
    imageUrl: campaign.imageUrl ?? undefined,
    ctaLabel: campaign.ctaLabel ?? undefined,
    ctaUrl: campaign.ctaUrl ?? undefined,
    placement: campaign.placement as AdPlacement,
  };
}

/**
 * Records a click event on a campaign and deducts CPC spend.
 * Called client-side when the user taps the ad CTA.
 */
export async function recordAdClick(
  campaignId: string,
  userId?: string,
  zoneId?: string
): Promise<void> {
  const campaign = await prisma.adCampaign.findUniqueOrThrow({
    where: { id: campaignId },
  });

  const cpc = campaign.costPerClick ? Number(campaign.costPerClick) : 0;

  await prisma.$transaction([
    prisma.adEvent.create({
      data: {
        campaignId,
        userId: userId ?? null,
        eventType: "CLICK",
        zoneId: zoneId ?? null,
      },
    }),
    prisma.adCampaign.update({
      where: { id: campaignId },
      data: {
        clicks: { increment: 1 },
        spentKes: { increment: cpc },
      },
    }),
  ]);

  // Auto-exhaust if budget fully spent
  const updatedSpent = Number(campaign.spentKes) + cpc;
  if (updatedSpent >= Number(campaign.budgetKes)) {
    await prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: "BUDGET_EXHAUSTED" },
    });
  }
}

/**
 * Returns high-level performance stats for a campaign (used in admin dashboard).
 */
export async function getCampaignStats(campaignId: string) {
  const campaign = await prisma.adCampaign.findUniqueOrThrow({
    where: { id: campaignId },
  });

  const ctr =
    campaign.impressions > 0
      ? (campaign.clicks / campaign.impressions) * 100
      : 0;

  return {
    campaignId,
    impressions: campaign.impressions,
    clicks: campaign.clicks,
    ctr: Math.round(ctr * 100) / 100,
    spentKes: Number(campaign.spentKes),
    budgetKes: Number(campaign.budgetKes),
    budgetUsedPercent:
      Math.round((Number(campaign.spentKes) / Number(campaign.budgetKes)) * 10000) / 100,
    status: campaign.status,
  };
}
