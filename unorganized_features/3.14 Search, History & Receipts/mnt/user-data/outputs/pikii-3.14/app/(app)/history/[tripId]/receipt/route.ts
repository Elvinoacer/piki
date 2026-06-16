// app/(app)/history/[tripId]/receipt/route.ts
// Feature 3.14 — Search, History & Receipts
// POST /history/:tripId/receipt  — generate (or re-fetch) a PDF receipt
// GET  /history/:tripId/receipt  — get a signed download URL

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateAndStoreReceipt,
  getReceiptSignedUrl,
} from "@/lib/receipt-generator";

interface RouteParams {
  params: { tripId: string };
}

// ── GET: return signed URL for existing receipt ───────────────
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: params.tripId,
      clientId: session.user.id, // clients only; riders use their own endpoint
    },
    select: { id: true, receiptUrl: true, status: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (!trip.receiptUrl) {
    return NextResponse.json(
      { error: "Receipt not yet generated. Use POST to generate." },
      { status: 404 }
    );
  }

  const signedUrl = await getReceiptSignedUrl(trip.id);
  if (!signedUrl) {
    return NextResponse.json({ error: "Could not generate signed URL" }, { status: 500 });
  }

  return NextResponse.json({ receiptUrl: signedUrl, tripId: trip.id });
}

// ── POST: generate or regenerate PDF receipt ──────────────────
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip = await prisma.trip.findFirst({
    where: {
      id: params.tripId,
      clientId: session.user.id,
    },
    select: {
      id: true,
      type: true,
      status: true,
      pickupAddress: true,
      dropoffAddress: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
      fareAmount: true,
      fareBreakdown: true,
      distanceKm: true,
      durationMin: true,
      paymentMethod: true,
      receiptUrl: true,
      createdAt: true,
      completedAt: true,
      cancelledAt: true,
      cancelReason: true,
      rider: {
        select: {
          id: true,
          name: true,
          phone: true,
          avatarUrl: true,
          riderProfile: { select: { plateNumber: true, rating: true } },
        },
      },
      rating: {
        where: { fromRole: "CLIENT" },
        select: { score: true, comment: true },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (!["COMPLETED", "CANCELLED"].includes(trip.status)) {
    return NextResponse.json(
      { error: "Receipt only available for completed or cancelled trips." },
      { status: 422 }
    );
  }

  // Map Prisma result → TripHistoryItem shape
  const tripItem = {
    id: trip.id,
    type: trip.type as never,
    status: trip.status as never,
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    pickupLat: trip.pickupLat,
    pickupLng: trip.pickupLng,
    dropoffLat: trip.dropoffLat,
    dropoffLng: trip.dropoffLng,
    fareAmount: trip.fareAmount,
    fareBreakdown: trip.fareBreakdown as never,
    distanceKm: trip.distanceKm,
    durationMin: trip.durationMin,
    paymentMethod: trip.paymentMethod as never,
    receiptUrl: trip.receiptUrl,
    createdAt: trip.createdAt.toISOString(),
    completedAt: trip.completedAt?.toISOString() ?? null,
    cancelledAt: trip.cancelledAt?.toISOString() ?? null,
    cancelReason: trip.cancelReason,
    rider: trip.rider
      ? {
          id: trip.rider.id,
          name: trip.rider.name,
          phone: trip.rider.phone,
          avatarUrl: trip.rider.avatarUrl ?? null,
          plateNumber: trip.rider.riderProfile?.plateNumber ?? null,
          rating: trip.rider.riderProfile?.rating ?? null,
        }
      : null,
    rating: trip.rating?.[0]
      ? { score: trip.rating[0].score, comment: trip.rating[0].comment }
      : null,
  };

  try {
    const signedUrl = await generateAndStoreReceipt(tripItem, session.user.name ?? "Client");
    return NextResponse.json({ receiptUrl: signedUrl, tripId: trip.id });
  } catch (err) {
    console.error("[POST /receipt] Error:", err);
    return NextResponse.json({ error: "Failed to generate receipt" }, { status: 500 });
  }
}
