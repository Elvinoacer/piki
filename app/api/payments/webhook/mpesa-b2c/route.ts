import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MpesaB2CCallbackBody } from "@/types/payments";
import { creditWallet } from "@/lib/payments/wallet";

export async function POST(req: NextRequest) {
  try {
    const body: MpesaB2CCallbackBody = await req.json();
    const result = body?.Result;

    if (!result) {
      return NextResponse.json({ error: "Invalid callback body" }, { status: 400 });
    }

    const { OriginatorConversationID, ResultCode, ResultDesc, ResultParameters } = result;

    const payout = await prisma.payout.findFirst({
      where: { mpesaB2cRef: OriginatorConversationID },
    });

    if (!payout) {
      return NextResponse.json({ error: "Payout not found" }, { status: 404 });
    }

    if (ResultCode === 0 && ResultParameters) {
      // Success
      const mpesaReceiptItem = ResultParameters.ResultParameter.find(
        (p: any) => p.Key === "B2CUtilityAccountAvailableFunds" // Example param, actual receipt param may differ
      );

      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });
    } else {
      // Failed - refund the wallet
      await prisma.$transaction(async (tx) => {
        await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED",
            failureReason: ResultDesc,
            processedAt: new Date(),
          },
        });

        await creditWallet({
          userId: payout.riderId,
          amount: Number(payout.amount),
          reason: "REFUND",
          referenceId: payout.id,
          description: `Failed payout refund: ${ResultDesc}`,
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("B2C Callback processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
