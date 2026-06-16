// src/app/api/referral/stats/route.ts
// GET — aggregate referral stats for the calling user
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const userId = session.user.id;

  const [code, redemptions] = await Promise.all([
    prisma.referralCode.findFirst({ where: { ownerId: userId, isActive: true } }),
    prisma.referralRedemption.findMany({
      where: { referrerId: userId },
      include: {
        referee: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalReferrals = redemptions.length;
  const qualifiedReferrals = redemptions.filter(
    (r) => r.status === "QUALIFIED" || r.status === "PAID"
  ).length;
  const paidReferrals = redemptions.filter((r) => r.status === "PAID").length;
  const totalEarned = redemptions
    .filter((r) => r.status === "PAID")
    .reduce((sum, r) => sum + Number(r.referrerBonus), 0);
  const pendingEarnings = redemptions
    .filter((r) => r.status === "QUALIFIED")
    .reduce((sum, r) => sum + Number(r.referrerBonus), 0);

  return NextResponse.json({
    code: code?.code ?? null,
    totalReferrals,
    qualifiedReferrals,
    paidReferrals,
    totalEarned,
    pendingEarnings,
    referrals: redemptions,
  });
}
