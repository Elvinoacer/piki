// src/app/api/riders/[riderId]/trust/route.ts
// GET /api/riders/:riderId/trust — public trust score + active badges for a rider

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: { riderId: string };
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { riderId } = params;

  const trustScore = await prisma.riderTrustScore.findUnique({
    where: { riderId },
    include: {
      badges: {
        where: { isActive: true },
        select: {
          type: true,
          label: true,
          awardedAt: true,
          expiresAt: true,
          isActive: true,
        },
      },
    },
  });

  if (!trustScore) {
    // Rider exists but hasn't been rated yet — return sensible defaults
    return NextResponse.json({
      riderId,
      averageScore: null,
      totalRatings: 0,
      currentStreakCount: 0,
      matchingPriority: 50,
      tierLevel: 1,
      badges: [],
    });
  }

  return NextResponse.json({
    riderId: trustScore.riderId,
    averageScore: trustScore.averageScore,
    totalRatings: trustScore.totalRatings,
    currentStreakCount: trustScore.currentStreakCount,
    matchingPriority: trustScore.matchingPriority,
    tierLevel: trustScore.tierLevel,
    badges: trustScore.badges.map((b) => ({
      type: b.type,
      label: b.label,
      awardedAt: b.awardedAt.toISOString(),
      expiresAt: b.expiresAt?.toISOString() ?? null,
      isActive: b.isActive,
    })),
  });
}
