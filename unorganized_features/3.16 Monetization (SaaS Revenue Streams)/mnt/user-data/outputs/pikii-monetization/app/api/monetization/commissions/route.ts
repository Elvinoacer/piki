// app/api/monetization/commissions/route.ts
// POST /api/monetization/commissions/resolve
//  — Resolves and applies the commission for a completed trip.
//    Called internally (server-to-server) by the trip-completion flow.
//    Writes WalletTransaction ledger entries.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveCommission } from "@/lib/monetization/commission-engine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // This endpoint is internal — only callable by the server itself (Server Actions)
  // or an admin. Validate via a shared internal secret header.
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternalCall = internalSecret === process.env.INTERNAL_API_SECRET;

  if (!isInternalCall) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
  }

  const body = await req.json();
  const { tripId } = body as { tripId?: string };

  if (!tripId) {
    return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  }

  // Load trip with rider and SACCO info
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      rider: {
        include: { saccoOrg: true },
      },
    },
  });

  if (trip.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Commission can only be resolved for completed trips." },
      { status: 422 }
    );
  }

  const tripFareKes = Number(trip.fareAmount);
  const riderId = trip.riderId;
  const saccoId = trip.rider?.saccoOrgId ?? null;

  try {
    const resolution = await resolveCommission({ riderId, saccoId, tripFareKes });

    // Write wallet ledger entries in a transaction
    await prisma.$transaction(async (tx) => {
      // Debit rider wallet: rider earns their share
      await tx.walletTransaction.create({
        data: {
          walletId: trip.rider!.walletId,
          type: "CREDIT",
          amountKes: resolution.riderEarnsKes,
          reference: `TRIP_EARN_${tripId}`,
          note: `Earnings for trip ${tripId} (after ${resolution.ratePercent}% commission)`,
          tripId,
        },
      });

      // Record commission deduction (platform revenue ledger)
      await tx.walletTransaction.create({
        data: {
          walletId: trip.rider!.walletId,
          type: "DEBIT",
          amountKes: resolution.commissionKes,
          reference: `COMMISSION_${tripId}`,
          note: `Platform commission [${resolution.ruleName}] — ${resolution.ratePercent}%`,
          tripId,
        },
      });

      // Update rider wallet balance
      await tx.wallet.update({
        where: { id: trip.rider!.walletId },
        data: { balance: { increment: resolution.riderEarnsKes } },
      });

      // Update trip with commission breakdown
      await tx.trip.update({
        where: { id: tripId },
        data: {
          commissionKes: resolution.commissionKes,
          commissionRuleId: resolution.ruleId,
        },
      });
    });

    return NextResponse.json({ data: { resolution } });
  } catch (err: any) {
    console.error("[commissions POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to resolve commission." },
      { status: 500 }
    );
  }
}
