import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { creditWallet } from "@/lib/payments/wallet";
import { MpesaSTKCallbackBody } from "@/types/payments";
import { receiptQueue } from "@/lib/payments/jobs";

export async function POST(req: NextRequest) {
  try {
    const body: MpesaSTKCallbackBody = await req.json();
    const stkCallback = body?.Body?.stkCallback;

    if (!stkCallback) {
      return NextResponse.json({ error: "Invalid callback body" }, { status: 400 });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    const payment = await prisma.payment.findUnique({
      where: { mpesaCheckoutRequestId: CheckoutRequestID },
      include: { trip: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (ResultCode === 0 && CallbackMetadata) {
      // Success
      const mpesaReceiptItem = CallbackMetadata.Item.find((item) => item.Name === "MpesaReceiptNumber");
      const receiptNumber = mpesaReceiptItem?.Value?.toString() || "";

      await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "COMPLETED",
            mpesaReceiptNumber: receiptNumber,
          },
        });

        // If trip payment, credit rider wallet
        if (payment.trip && payment.trip.riderId) {
          await creditWallet({
            userId: payment.trip.riderId,
            amount: Number(payment.amount),
            reason: "TRIP_EARNING",
            referenceId: payment.id,
            description: `Fare for trip ${payment.trip.id}`,
          });
        }
      });

      // Queue receipt job
      if (payment.tripId) {
        await receiptQueue.add("generate-receipt", {
          tripId: payment.tripId,
          paymentId: payment.id,
        });
      }
    } else {
      // Failed
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          failureReason: ResultDesc,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("STK Callback processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
