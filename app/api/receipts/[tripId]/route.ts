import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/payments/receipt";

export async function GET(req: NextRequest, { params }: { params: { tripId: string } }) {
  try {
    const { tripId } = params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { client: true, rider: { include: { riderProfile: true } } },
    });

    const payment = await prisma.payment.findUnique({
      where: { tripId },
    });

    if (!trip || !payment) {
      return NextResponse.json({ error: "Trip or Payment not found" }, { status: 404 });
    }

    const pdfBuffer = await generateReceiptPdf({
      receiptNumber: payment.id.slice(-8).toUpperCase(),
      tripId: trip.id,
      clientName: trip.client.firstName || "Client",
      riderName: trip.rider?.firstName || "Rider",
      riderPlate: trip.rider?.riderProfile?.numberPlate || "N/A",
      pickupAddress: trip.pickupAddress,
      dropoffAddress: trip.dropoffAddress || "N/A",
      tripDate: trip.tripEndedAt || trip.updatedAt,
      distanceKm: Number(trip.distanceKm) || 0,
      durationMinutes: Number(trip.estimatedMins) || 0, // Using estimatedMins from trip
      fareBreakdown: {
        baseFare: 0, // Simplified for this example, usually pulled from a breakdown JSON
        tripFare: Number(payment.amount),
        tip: Number(payment.tipAmount) || 0,
        commissionRate: Number(payment.commissionRate) || 0,
        commissionAmount: Number(payment.commissionAmount) || 0,
        riderEarning: Number(payment.riderEarning) || 0,
        total: Number(payment.amount) + (Number(payment.tipAmount) || 0),
      },
      paymentMethod: payment.method,
      mpesaReceiptNumber: payment.mpesaReceiptNumber || undefined,
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `inline; filename="receipt-${trip.id}.pdf"`);

    return new NextResponse(pdfBuffer as any, { headers, status: 200 });
  } catch (error: any) {
    console.error("Receipt error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
