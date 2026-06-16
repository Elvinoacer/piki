import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creditWallet, debitWallet } from "@/lib/payments/wallet";

export async function POST(req: NextRequest) {
  try {
    const { tripId, payerId, riderId, amount } = await req.json();

    if (!tripId || !payerId || !riderId || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Process Tip via Wallet transfer
    await prisma.$transaction(async (tx) => {
      await debitWallet({
        userId: payerId,
        amount: Number(amount),
        reason: "TIP_SENT",
        referenceId: tripId,
        description: `Tip sent for trip ${tripId}`,
      });

      await creditWallet({
        userId: riderId,
        amount: Number(amount),
        reason: "TIP_RECEIVED",
        referenceId: tripId,
        description: `Tip received for trip ${tripId}`,
      });
    });

    // Optionally update the payment record to reflect tip amount
    await prisma.payment.updateMany({
      where: { tripId, payerId },
      data: { tipAmount: amount },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Tip error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
