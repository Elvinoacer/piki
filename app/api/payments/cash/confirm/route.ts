import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { receiptQueue } from "@/lib/payments/jobs";
import { debitWallet } from "@/lib/payments/wallet";

export async function POST(req: NextRequest) {
  try {
    const { tripId, riderId, amount, commissionAmount } = await req.json();

    if (!tripId || !riderId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.riderId !== riderId) {
      return NextResponse.json({ error: "Trip not found or unauthorized" }, { status: 404 });
    }

    // 1. Create Payment Record for CASH
    const payment = await prisma.payment.create({
      data: {
        tripId,
        payerId: trip.clientId,
        method: "CASH",
        amount,
        status: "COMPLETED",
        commissionAmount,
      },
    });

    // 2. Debit Rider Wallet for Commission if applicable
    if (commissionAmount && commissionAmount > 0) {
      await debitWallet({
        userId: riderId,
        amount: Number(commissionAmount),
        reason: "COMMISSION_DEDUCTION",
        referenceId: payment.id,
        description: `Commission for cash trip ${tripId}`,
      });
    }

    // 3. Queue Receipt
    await receiptQueue.add("generate-receipt", {
      tripId,
      paymentId: payment.id,
    });

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (error: any) {
    console.error("Cash Confirm error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
