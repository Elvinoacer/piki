// ============================================================
// src/app/api/trips/route.ts
// Pikii — POST /api/trips
// Handles all trip types from Section 3.3
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // your NextAuth config
import { prisma } from "@/lib/prisma";    // your Prisma client singleton
import {
  CreateTripSchema,
  isParcelType,
  isScheduledType,
  isMultiStopType,
} from "@/lib/validations/trip";

// ─────────────────────────────────────────────
// POST /api/trips
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — must be a signed-in client
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientId = session.user.id;

    // 2. Parse & validate body
    const body = await req.json();
    const parsed = CreateTripSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // 3. Build Prisma create data based on trip type
    // ------------------------------------------------
    // All types share a common base; type-specific fields
    // are merged in below.

    const baseData = {
      clientId,
      type: input.type,
      status: "PENDING" as const,
      pickupLat: input.pickup.lat,
      pickupLng: input.pickup.lng,
      pickupAddress: input.pickup.address,
      clientNotes: input.clientNotes ?? null,
    };

    // Dropoff (present on all types except MULTI_STOP)
    const dropoffData =
      "dropoff" in input && input.dropoff
        ? {
            dropoffLat: input.dropoff.lat,
            dropoffLng: input.dropoff.lng,
            dropoffAddress: input.dropoff.address,
          }
        : {};

    // Parcel / Errand extras
    const parcelData = isParcelType(input)
      ? {
          parcelSize: input.parcelSize,
          parcelDescription: input.parcelDescription,
          recipientName: input.recipientName,
          recipientPhone: input.recipientPhone,
          requiresSignature: input.requiresSignature,
        }
      : {};

    // Scheduled ride extras
    const scheduleData = isScheduledType(input)
      ? {
          scheduledAt: new Date(input.scheduledAt),
        }
      : {};

    // Multi-stop: derive final dropoff from last stop
    const multiStopDropoff =
      isMultiStopType(input) && input.stops.length > 0
        ? (() => {
            const last = input.stops[input.stops.length - 1];
            return {
              dropoffLat: last.lat,
              dropoffLng: last.lng,
              dropoffAddress: last.address,
            };
          })()
        : {};

    // 4. Create Trip + nested TripStops in one transaction
    const trip = await prisma.$transaction(async (tx) => {
      const created = await tx.trip.create({
        data: {
          ...baseData,
          ...dropoffData,
          ...parcelData,
          ...scheduleData,
          ...multiStopDropoff,
        },
      });

      // Create stops for MULTI_STOP
      if (isMultiStopType(input) && input.stops.length > 0) {
        await tx.tripStop.createMany({
          data: input.stops.map((stop) => ({
            tripId: created.id,
            order: stop.order,
            lat: stop.lat,
            lng: stop.lng,
            address: stop.address,
            label: stop.label ?? null,
          })),
        });
      }

      return tx.trip.findUniqueOrThrow({
        where: { id: created.id },
        include: { stops: { orderBy: { order: "asc" } } },
      });
    });

    // 5. Enqueue matching job
    //    (wire to your BullMQ queue; stub here so route compiles standalone)
    await enqueueMatchingJob(trip.id, input.type);

    // 6. Return created trip
    return NextResponse.json({ trip }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/trips]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// GET /api/trips  — client trip history
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");   // optional filter
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = searchParams.get("cursor"); // cuid for cursor pagination

    const trips = await prisma.trip.findMany({
      where: {
        clientId: session.user.id,
        ...(type ? { type: type as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        stops: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1, // fetch one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasNextPage = trips.length > limit;
    const items = hasNextPage ? trips.slice(0, -1) : trips;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return NextResponse.json({ trips: items, nextCursor });
  } catch (err) {
    console.error("[GET /api/trips]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// Stub — replace with real BullMQ enqueue call
// ─────────────────────────────────────────────

async function enqueueMatchingJob(tripId: string, tripType: string) {
  // TODO: import matchingQueue from "@/lib/queues/matching"
  // await matchingQueue.add("match-trip", { tripId, tripType }, {
  //   attempts: 3,
  //   backoff: { type: "exponential", delay: 1000 },
  // });
  console.log(`[matching-queue] enqueued tripId=${tripId} type=${tripType}`);
}
