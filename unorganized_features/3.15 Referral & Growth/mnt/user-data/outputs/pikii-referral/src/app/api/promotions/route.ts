// src/app/api/promotions/route.ts
// GET  — list active promotions for a placement
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BannerPlacement } from "@/types/referral";

const VALID_PLACEMENTS: BannerPlacement[] = [
  "HOME",
  "BOOKING",
  "PAYMENT",
  "EARNINGS",
  "PROFILE",
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const placementParam = searchParams.get("placement")?.toUpperCase() as BannerPlacement;
  const placement: BannerPlacement = VALID_PLACEMENTS.includes(placementParam)
    ? placementParam
    : "HOME";

  const now = new Date();
  const role = session.user.role as string;

  // Fetch active promos for this role + placement, excluding already dismissed
  const dismissed = await prisma.promotionDismissal.findMany({
    where: { userId: session.user.id },
    select: { promotionId: true },
  });
  const dismissedIds = dismissed.map((d) => d.promotionId);

  const promotions = await prisma.promotion.findMany({
    where: {
      isActive: true,
      placement,
      startsAt: { lte: now },
      endsAt: { gte: now },
      targetRole: { in: ["ALL", role] },
      id: { notIn: dismissedIds },
    },
    include: {
      promoCode: { select: { code: true, discountType: true, discountValue: true } },
    },
    orderBy: { priority: "desc" },
    take: 5,
  });

  // Increment impressions in background
  if (promotions.length > 0) {
    prisma.promotion
      .updateMany({
        where: { id: { in: promotions.map((p) => p.id) } },
        data: { impressions: { increment: 1 } },
      })
      .catch(() => {});
  }

  return NextResponse.json({ promotions });
}
