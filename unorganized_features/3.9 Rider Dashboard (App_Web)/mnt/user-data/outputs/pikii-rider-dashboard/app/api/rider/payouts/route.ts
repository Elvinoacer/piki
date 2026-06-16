// app/api/rider/payouts/route.ts
// GET  /api/rider/payouts       — list payout history
// POST /api/rider/payouts       — request a new payout (M-Pesa B2C)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchPayouts, fetchWalletBalance } from "@/lib/api/riderDashboard";

const MIN_PAYOUT_KES = 100; // minimum threshold per PRD §3.5

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const payouts = await fetchPayouts(session.user.riderId as string);
  return NextResponse.json({ payouts });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const riderId = session.user.riderId as string;
  const { amount, phoneNumber } = await req.json();

  if (!amount || amount < MIN_PAYOUT_KES) {
    return NextResponse.json(
      { message: `Minimum payout is KES ${MIN_PAYOUT_KES}` },
      { status: 400 }
    );
  }

  // Verify wallet has sufficient available balance
  const walletBalance = await fetchWalletBalance(riderId);
  if (amount > walletBalance.available) {
    return NextResponse.json(
      { message: "Insufficient wallet balance" },
      { status: 400 }
    );
  }

  // Create payout record + deduct from wallet (transactional)
  const profile = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    select: { userId: true },
  });

  const [payout] = await prisma.$transaction([
    prisma.payout.create({
      data: {
        riderId,
        amount,
        phoneNumber,
        status: "PENDING",
      },
    }),
    prisma.wallet.update({
      where: { userId: profile.userId },
      data: {
        balance: { decrement: amount },
        pending: { increment: amount },
      },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: (
          await prisma.wallet.findUniqueOrThrow({
            where: { userId: profile.userId },
            select: { id: true },
          })
        ).id,
        amount: -amount,
        reason: "PAYOUT_REQUEST",
      },
    }),
  ]);

  // TODO: Enqueue BullMQ job for Daraja B2C API call
  // await payoutQueue.add('mpesa-b2c', { payoutId: payout.id, amount, phoneNumber })

  const updatedWallet = await fetchWalletBalance(riderId);

  return NextResponse.json(
    {
      payout: {
        id: payout.id,
        amount: payout.amount,
        status: payout.status,
        requestedAt: payout.requestedAt.toISOString(),
        processedAt: null,
        mpesaRef: null,
        phoneNumber: payout.phoneNumber,
      },
      wallet: updatedWallet,
    },
    { status: 201 }
  );
}
