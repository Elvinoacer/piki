import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { debitWallet } from "@/lib/payments/wallet";
import { payoutQueue } from "@/lib/payments/jobs";

export async function GET(req: NextRequest) {
  try {
    const riderId = req.nextUrl.searchParams.get("riderId");
    if (!riderId) {
      return NextResponse.json({ error: "Missing riderId" }, { status: 400 });
    }

    const payouts = await prisma.payout.findMany({
      where: { riderId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ payouts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { riderId, amount, phone } = await req.json();

    if (!riderId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const riderProfile = await prisma.riderProfile.findUnique({
      where: { userId: riderId },
    });

    const mpesaPhone = phone || riderProfile?.mpesaPhone;

    if (!mpesaPhone) {
      return NextResponse.json({ error: "No M-Pesa phone number registered or provided" }, { status: 400 });
    }

    // 1. Debit Wallet
    await debitWallet({
      userId: riderId,
      amount: Number(amount),
      reason: "PAYOUT",
      description: "Withdrawal to M-Pesa",
    });

    // 2. Create Payout Record
    const payout = await prisma.payout.create({
      data: {
        riderId,
        amount: Number(amount),
        mpesaPhone,
        status: "PENDING",
      },
    });

    // 3. Queue Payout Job
    await payoutQueue.add("process-payout", {
      payoutId: payout.id,
    }, { jobId: `payout-${payout.id}` });

    return NextResponse.json({ success: true, payoutId: payout.id });
  } catch (error: any) {
    console.error("Payout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
