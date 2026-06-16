// app/api/rider/requests/[requestId]/route.ts
// POST /api/rider/requests/[requestId]/accept
// POST /api/rider/requests/[requestId]/decline

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: { requestId: string };
}

// Accept a trip request
export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const action = url.pathname.split("/").pop(); // "accept" or "decline"
  const riderId = session.user.riderId as string;

  const trip = await prisma.trip.findUnique({
    where: { id: params.requestId },
  });

  if (!trip) {
    return NextResponse.json({ message: "Request not found" }, { status: 404 });
  }
  if (trip.status !== "REQUESTED") {
    return NextResponse.json(
      { message: "Request already taken or expired" },
      { status: 409 }
    );
  }

  if (action === "accept") {
    const updated = await prisma.trip.update({
      where: { id: params.requestId },
      data: {
        riderId,
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
    await prisma.riderProfile.update({
      where: { id: riderId },
      data: { status: "ON_TRIP" },
    });
    return NextResponse.json({
      trip: {
        tripId: updated.id,
        status: updated.status,
        clientName: updated.clientName,
        clientAvatar: updated.clientAvatar,
        pickupAddress: updated.pickupAddress,
        dropoffAddress: updated.dropoffAddress,
        fare: updated.grossFare,
      },
    });
  }

  if (action === "decline") {
    // Log the decline for acceptance-rate calculation (background job handles aggregation)
    await prisma.auditLog?.create?.({
      data: {
        action: "TRIP_DECLINED",
        userId: session.user.id as string,
        metadata: { tripId: params.requestId },
      },
    }).catch(() => {}); // graceful if AuditLog not yet migrated

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Unknown action" }, { status: 400 });
}
