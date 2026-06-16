/**
 * lib/matching/engine.ts
 *
 * Matching Engine — orchestrates the full trip-matching lifecycle:
 *   1. Query nearby riders (PostGIS)
 *   2. Score & rank candidates
 *   3. Build dispatch plan
 *   4. Broadcast/sequential dispatch via WebSocket
 *   5. Auto-expand radius if no acceptance within timeout
 *   6. Handle first-accept-wins and notify losers
 *   7. Expire trip if max radius exhausted
 *
 * Called from the trip-request API route and runs as a background
 * async process (fire-and-forget from the route; can also be moved
 * to a BullMQ worker for better resilience).
 */

import { prisma } from "@/lib/prisma";
import { findNearbyRiders } from "@/lib/geo/queries";
import { rankRiders, buildDispatchPlan, buildRadiusSchedule } from "@/lib/matching/algorithm";
import { getSocketServer } from "@/lib/websocket/server";
import { TripStatus, BroadcastResponse } from "@/app/generated/prisma/client";

// ─── Types ───────────────────────────────────────────────────

interface MatchEngineOpts {
  tripId: string;
  pickupLat: number;
  pickupLng: number;
  startRadiusKm: number;
  expandRadiusKm: number;
  maxRadiusKm: number;
  waitSecsPerStep: number;  // How long to wait per radius step before expanding
  dispatchStrategy: "BROADCAST" | "SEQUENTIAL";
  broadcastBatchSize?: number;
  perRiderTimeoutSecs?: number; // For sequential: how long each rider has
}

// ─── Main Engine Entry Point ──────────────────────────────────

export async function runMatchingEngine(opts: MatchEngineOpts): Promise<void> {
  const {
    tripId,
    pickupLat,
    pickupLng,
    startRadiusKm,
    expandRadiusKm,
    maxRadiusKm,
    waitSecsPerStep,
    dispatchStrategy,
    broadcastBatchSize = 5,
    perRiderTimeoutSecs = 15,
  } = opts;

  const io = getSocketServer();
  const radiusSchedule = buildRadiusSchedule({
    startKm: startRadiusKm,
    expandKm: expandRadiusKm,
    maxKm: maxRadiusKm,
    waitSecsPerStep,
  });

  // ── Update trip to BROADCASTING ───────────────────────────
  await updateTripStatus(tripId, TripStatus.BROADCASTING);

  // Notify client: we're searching
  io.to(`client:${tripId}`).emit("trip:searching", {
    tripId,
    radiusKm: startRadiusKm,
  });

  // ── Walk through radius expansion steps ───────────────────
  for (const step of radiusSchedule) {
    // Check trip hasn't been cancelled between steps
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { status: true },
    });

    if (!trip || trip.status === TripStatus.CANCELLED) {
      return; // Abort silently
    }

    if (
      trip.status === TripStatus.ACCEPTED ||
      trip.status === TripStatus.ARRIVING
    ) {
      return; // Already matched in a previous step
    }

    // Find candidates at this radius
    const candidates = await findNearbyRiders(
      pickupLat,
      pickupLng,
      step.radiusKm
    );

    // Notify client of expanding radius
    io.to(`client:${tripId}`).emit("trip:searching", {
      tripId,
      radiusKm: step.radiusKm,
      ridersFound: candidates.length,
    });

    if (candidates.length === 0) {
      // No riders at this radius — wait and try expanding
      await sleep(step.waitSecs * 1000);
      continue;
    }

    const ranked = rankRiders(candidates);
    const plan = buildDispatchPlan(ranked, dispatchStrategy, broadcastBatchSize);

    // Dispatch each batch
    for (const batch of plan.batches) {
      const accepted = await dispatchBatch({
        tripId,
        riderIds: batch,
        radiusKm: step.radiusKm,
        timeoutSecs: dispatchStrategy === "SEQUENTIAL"
          ? perRiderTimeoutSecs
          : step.waitSecs,
        io,
      });

      if (accepted) {
        return; // A rider accepted — we're done
      }

      // Check for cancellation between batches
      const current = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { status: true },
      });
      if (current?.status === TripStatus.CANCELLED) return;
    }

    // All batches exhausted at this radius — wait remaining time before expanding
    // (for BROADCAST, waitSecs already consumed inside dispatchBatch)
  }

  // ── No rider accepted across all radius steps → EXPIRE ────
  await expireTrip(tripId);
  io.to(`client:${tripId}`).emit("trip:expired", {
    tripId,
    message: "No riders available nearby. Please try again.",
  });
}

// ─── Dispatch a batch of riders ──────────────────────────────

interface DispatchBatchOpts {
  tripId: string;
  riderIds: string[];
  radiusKm: number;
  timeoutSecs: number;
  io: ReturnType<typeof getSocketServer>;
}

/**
 * Send trip request to a batch of riders and wait for acceptance.
 * For BROADCAST: returns true as soon as any one rider accepts.
 * For SEQUENTIAL: single-rider batches mean this just offers one rider.
 */
async function dispatchBatch(opts: DispatchBatchOpts): Promise<boolean> {
  const { tripId, riderIds, radiusKm, timeoutSecs, io } = opts;

  // Fetch trip details to include in the offer
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      pickupAddress: true,
      dropoffAddress: true,
      distanceKm: true,
      estimatedMins: true,
      fareEstimate: true,
      type: true,
    },
  });

  if (!trip) return false;

  // Log all broadcasts
  await prisma.tripBroadcast.createMany({
    data: riderIds.map((riderId) => ({
      tripId,
      riderId,
      radiusKm,
    })),
    skipDuplicates: true,
  });

  // Emit offer to all riders in batch
  for (const riderId of riderIds) {
    io.to(`rider:${riderId}`).emit("trip:offer", {
      tripId,
      timeoutSecs,
      trip: {
        pickupAddress: trip.pickupAddress,
        dropoffAddress: trip.dropoffAddress,
        distanceKm: trip.distanceKm,
        estimatedMins: trip.estimatedMins,
        fareEstimate: trip.fareEstimate,
        type: trip.type,
      },
    });
  }

  // Poll for acceptance during the timeout window
  const deadline = Date.now() + timeoutSecs * 1000;
  const pollIntervalMs = 500;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);

    const accepted = await prisma.tripBroadcast.findFirst({
      where: {
        tripId,
        riderId: { in: riderIds },
        response: BroadcastResponse.ACCEPTED,
      },
      select: { riderId: true },
    });

    if (accepted) {
      // Mark all other riders in this batch as EXPIRED
      await prisma.tripBroadcast.updateMany({
        where: {
          tripId,
          riderId: { in: riderIds.filter((id) => id !== accepted.riderId) },
          response: null,
        },
        data: { response: BroadcastResponse.EXPIRED, respondedAt: new Date() },
      });

      // Notify non-accepting riders
      for (const riderId of riderIds) {
        if (riderId !== accepted.riderId) {
          io.to(`rider:${riderId}`).emit("trip:offer:taken", { tripId });
        }
      }

      return true;
    }

    // Check trip wasn't cancelled externally
    const tripStatus = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { status: true },
    });
    if (
      !tripStatus ||
      tripStatus.status === TripStatus.CANCELLED ||
      tripStatus.status === TripStatus.ACCEPTED
    ) {
      return tripStatus?.status === TripStatus.ACCEPTED;
    }
  }

  // Timeout: mark all as EXPIRED
  await prisma.tripBroadcast.updateMany({
    where: { tripId, riderId: { in: riderIds }, response: null },
    data: { response: BroadcastResponse.EXPIRED, respondedAt: new Date() },
  });

  // Tell riders their window closed
  for (const riderId of riderIds) {
    io.to(`rider:${riderId}`).emit("trip:offer:expired", { tripId });
  }

  return false;
}

// ─── Helpers ─────────────────────────────────────────────────

async function updateTripStatus(tripId: string, status: TripStatus) {
  await prisma.trip.update({ where: { id: tripId }, data: { status } });
}

async function expireTrip(tripId: string) {
  await prisma.trip.update({
    where: { id: tripId },
    data: { status: TripStatus.EXPIRED },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
