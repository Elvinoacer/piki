/**
 * app/api/trips/route.ts
 *
 * POST /api/trips
 * Create a new trip request and kick off the matching engine.
 *
 * Body:
 *   { pickupLat, pickupLng, pickupAddress,
 *     dropoffLat, dropoffLng, dropoffAddress,
 *     type: TripType, stops?: TripStop[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getZoneForPoint } from "@/lib/geo/queries";
import { runMatchingEngine } from "@/lib/matching/engine";
import { TripType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    pickupLat,
    pickupLng,
    pickupAddress,
    dropoffLat,
    dropoffLng,
    dropoffAddress,
    type = TripType.BODA_RIDE,
    stops = [],
    distanceKm,
    estimatedMins,
    fareEstimate,
  } = body as {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropoffLat: number;
    dropoffLng: number;
    dropoffAddress: string;
    type?: TripType;
    stops?: { lat: number; lng: number; address: string; order: number }[];
    distanceKm?: number;
    estimatedMins?: number;
    fareEstimate?: number;
  };

  // ── Validate ────────────────────────────────────────────────
  if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
    return NextResponse.json(
      { error: "pickup and dropoff coordinates required" },
      { status: 400 }
    );
  }

  // ── Geofence check — is pickup inside a served zone? ────────
  const zone = await getZoneForPoint(pickupLat, pickupLng);
  if (!zone) {
    return NextResponse.json(
      { error: "Service not available in your area yet." },
      { status: 422 }
    );
  }

  // ── Fetch zone dispatch config ───────────────────────────────
  const zoneRecord = await prisma.zone.findUnique({ where: { id: zone.id } });
  const startRadiusKm  = zoneRecord?.defaultRadiusKm ?? 3;
  const maxRadiusKm    = zoneRecord?.maxRadiusKm     ?? 10;

  // ── Create trip ──────────────────────────────────────────────
  const trip = await prisma.trip.create({
    data: {
      clientId:       session.user.id,
      status:         "REQUESTED",
      type,
      pickupLat,
      pickupLng,
      pickupAddress,
      dropoffLat,
      dropoffLng,
      dropoffAddress,
      distanceKm,
      estimatedMins,
      fareEstimate,
      zoneId:         zone.id,
      searchRadiusKm: startRadiusKm,
      maxRadiusKm,
      stops: {
        create: stops.map((s) => ({
          order:   s.order,
          lat:     s.lat,
          lng:     s.lng,
          address: s.address,
        })),
      },
    },
    select: {
      id:             true,
      status:         true,
      pickupAddress:  true,
      dropoffAddress: true,
      fareEstimate:   true,
      distanceKm:     true,
      estimatedMins:  true,
      type:           true,
      zoneId:         true,
    },
  });

  // ── Run matching engine (fire-and-forget) ────────────────────
  // In production move this to a BullMQ job for resilience.
  runMatchingEngine({
    tripId:          trip.id,
    pickupLat,
    pickupLng,
    startRadiusKm,
    expandRadiusKm:  2,
    maxRadiusKm,
    waitSecsPerStep: 30,
    dispatchStrategy: "BROADCAST",
    broadcastBatchSize: 5,
    perRiderTimeoutSecs: 15,
  }).catch((err) => {
    console.error("[MatchingEngine] Error for trip", trip.id, err);
  });

  return NextResponse.json({ trip }, { status: 201 });
}
