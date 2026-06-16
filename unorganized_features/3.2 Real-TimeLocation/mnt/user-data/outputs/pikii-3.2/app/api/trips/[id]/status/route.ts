/**
 * app/api/trips/[id]/status/route.ts
 *
 * PATCH /api/trips/:id/status
 * Drive the trip state machine.
 *
 * Valid transitions:
 *   Rider:  BROADCASTING → ACCEPTED (accept offer)
 *           ACCEPTED     → ARRIVING
 *           ARRIVING     → ARRIVED
 *           ARRIVED      → IN_PROGRESS
 *           IN_PROGRESS  → COMPLETED
 *   Client: REQUESTED | BROADCASTING | ACCEPTED | ARRIVING → CANCELLED
 *   Rider:  ACCEPTED | ARRIVING → CANCELLED
 *
 * Body: { action: "accept" | "decline" | "arriving" | "arrived" | "start" | "complete" | "cancel",
 *         cancelReason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSocketServer } from "@/lib/websocket/server";
import { TripStatus, BroadcastResponse } from "@prisma/client";

type Action =
  | "accept"
  | "decline"
  | "arriving"
  | "arrived"
  | "start"
  | "complete"
  | "cancel";

const RIDER_TRANSITIONS: Record<Action, TripStatus | null> = {
  accept:   TripStatus.ACCEPTED,
  decline:  null, // Special handling
  arriving: TripStatus.ARRIVING,
  arrived:  TripStatus.ARRIVED,
  start:    TripStatus.IN_PROGRESS,
  complete: TripStatus.COMPLETED,
  cancel:   TripStatus.CANCELLED,
};

const CLIENT_ALLOWED_ACTIONS: Action[] = ["cancel"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tripId = params.id;
  const { action, cancelReason } = (await req.json()) as {
    action: Action;
    cancelReason?: string;
  };

  const userId = session.user.id;
  const role   = session.user.role as string;

  // ── Fetch trip ───────────────────────────────────────────────
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id:        true,
      clientId:  true,
      riderId:   true,
      status:    true,
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  // ── Authorization check ─────────────────────────────────────
  const isRider  = role === "RIDER"  && (trip.riderId === userId || action === "accept");
  const isClient = role === "CLIENT" && trip.clientId === userId;

  if (!isRider && !isClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isClient && !CLIENT_ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: "Clients can only cancel trips" },
      { status: 400 }
    );
  }

  const io = getSocketServer();

  // ── Handle DECLINE (no status change on trip) ───────────────
  if (action === "decline" && isRider) {
    await prisma.tripBroadcast.updateMany({
      where: { tripId, riderId: userId, response: null },
      data:  { response: BroadcastResponse.DECLINED, respondedAt: new Date() },
    });
    return NextResponse.json({ message: "Declined" });
  }

  // ── Handle ACCEPT ────────────────────────────────────────────
  if (action === "accept" && isRider) {
    // Idempotency: check if already accepted by someone else
    if (
      trip.status !== TripStatus.BROADCASTING &&
      trip.status !== TripStatus.REQUESTED
    ) {
      return NextResponse.json(
        { error: "Trip already accepted or expired" },
        { status: 409 }
      );
    }

    const updated = await prisma.trip.update({
      where: { id: tripId },
      data: {
        status:         TripStatus.ACCEPTED,
        riderId:        userId,
        riderAcceptedAt: new Date(),
      },
    });

    await prisma.tripBroadcast.updateMany({
      where: { tripId, riderId: userId },
      data:  { response: BroadcastResponse.ACCEPTED, respondedAt: new Date() },
    });

    // Notify client
    io.to(`client:${tripId}`).emit("trip:accepted", {
      tripId,
      riderId: userId,
      status: updated.status,
    });

    // Rider joins shared trip room
    io.to(`rider:${userId}`).emit("trip:room:join", { tripId });

    return NextResponse.json({ trip: updated });
  }

  // ── Handle status transitions ────────────────────────────────
  const newStatus = RIDER_TRANSITIONS[action];
  if (!newStatus) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  // Validate transition
  const validFrom: Record<TripStatus, TripStatus[]> = {
    [TripStatus.REQUESTED]:    [],
    [TripStatus.BROADCASTING]: [],
    [TripStatus.ACCEPTED]:     [TripStatus.BROADCASTING, TripStatus.REQUESTED],
    [TripStatus.ARRIVING]:     [TripStatus.ACCEPTED],
    [TripStatus.ARRIVED]:      [TripStatus.ARRIVING],
    [TripStatus.IN_PROGRESS]:  [TripStatus.ARRIVED],
    [TripStatus.COMPLETED]:    [TripStatus.IN_PROGRESS],
    [TripStatus.CANCELLED]:    [
      TripStatus.REQUESTED,
      TripStatus.BROADCASTING,
      TripStatus.ACCEPTED,
      TripStatus.ARRIVING,
    ],
    [TripStatus.EXPIRED]:      [],
  };

  if (!validFrom[newStatus]?.includes(trip.status)) {
    return NextResponse.json(
      { error: `Cannot transition from ${trip.status} to ${newStatus}` },
      { status: 409 }
    );
  }

  // Build update payload
  const updateData: Record<string, unknown> = { status: newStatus };

  if (newStatus === TripStatus.ARRIVED)      updateData.riderArrivedAt  = new Date();
  if (newStatus === TripStatus.IN_PROGRESS)  updateData.tripStartedAt   = new Date();
  if (newStatus === TripStatus.COMPLETED)    updateData.tripEndedAt      = new Date();
  if (newStatus === TripStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
    updateData.cancelledBy = isClient ? "client" : "rider";
    updateData.cancelReason = cancelReason ?? null;
  }

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data:  updateData,
  });

  // ── Broadcast status to shared trip room ─────────────────────
  io.to(`trip:${tripId}`).emit("trip:status:update", {
    tripId,
    status: updated.status,
    ts:     Date.now(),
  });

  // ── Special post-completion hooks ─────────────────────────────
  if (newStatus === TripStatus.COMPLETED) {
    // Trigger payment flow, rating prompts, commission calculation
    // These are separate concerns handled by other modules.
    io.to(`client:${tripId}`).emit("trip:completed", { tripId });
    io.to(`rider:${trip.riderId!}`).emit("trip:completed", { tripId });
  }

  return NextResponse.json({ trip: updated });
}
