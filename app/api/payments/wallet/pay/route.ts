import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { debitWallet, creditWallet } from "@/lib/payments/wallet";
import { receiptQueue } from "@/lib/payments/jobs";

export async function POST(req: NextRequest) {
  try {
    const { tripId, payerId, amount, tipAmount } = await req.json();

    if (!tripId || !payerId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || !trip.riderId) {
      return NextResponse.json({ error: "Trip or rider not found" }, { status: 404 });
    }

    const totalDeduction = Number(amount) + (Number(tipAmount) || 0);

    // 1. Debit Payer Wallet
    await debitWallet({
      userId: payerId,
      amount: totalDeduction,
      reason: "TRIP_PAYMENT",
      referenceId: tripId,
      description: `Payment for trip ${tripId}`,
    });

    // 2. Create Payment Record
    const payment = await prisma.payment.create({
      data: {
        tripId,
        payerId,
        method: "WALLET",
        amount,
        tipAmount,
        status: "COMPLETED",
      },
    });

    // 3. Credit Rider Wallet
    await creditWallet({
      userId: trip.riderId,
      amount: Number(amount),
      reason: "TRIP_EARNING",
      referenceId: payment.id,
      description: `Fare for trip ${tripId}`,
    });

    if (tipAmount) {
      await creditWallet({
        userId: trip.riderId,
        amount: Number(tipAmount),
        reason: "TIP_RECEIVED",
        referenceId: payment.id,
        description: `Tip for trip ${tripId}`,
      });
    }

    // 4. Queue Receipt
    await receiptQueue.add("generate-receipt", {
      tripId,
      paymentId: payment.id,
    });

    return NextResponse.json({ success: true, paymentId: payment.id });
  } catch (error: any) {
    console.error("Wallet Pay error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
