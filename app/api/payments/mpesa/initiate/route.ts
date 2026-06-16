import { NextRequest, NextResponse } from "next/server";
import { stkPush } from "@/lib/payments/daraja";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { tripId, phone, amount, tipAmount } = await req.json();

    if (!tripId || !phone || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Initiate STK push
    const stkResponse = await stkPush({
      phone,
      amount: Number(amount) + (Number(tipAmount) || 0),
      accountReference: `PIKII-TRIP-${tripId}`,
      transactionDesc: `Payment for trip ${tripId}`,
    });

    // Create a Payment record in DB
    const payment = await prisma.payment.create({
      data: {
        tripId,
        payerId: trip.clientId,
        method: "MPESA",
        amount,
        tipAmount,
        status: "PENDING",
        mpesaCheckoutRequestId: stkResponse.CheckoutRequestID,
        mpesaPhone: phone,
      },
    });

    return NextResponse.json({ success: true, paymentId: payment.id, checkoutRequestId: stkResponse.CheckoutRequestID });
  } catch (error: any) {
    console.error("STK Push error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
