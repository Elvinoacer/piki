/**
 * app/api/location/route.ts
 *
 * PUT /api/location
 *
 * REST fallback for location updates when the WebSocket is unavailable
 * (offline resilience — rider app queues updates and flushes on reconnect).
 *
 * Body: Array of location points (batch flush):
 *   { points: [{ lat, lng, heading?, speedKmh?, accuracy?, ts, tripId? }] }
 *
 * Points are processed in chronological order; only the latest position
 * is used for the live PostGIS record, but all points are appended to the
 * GPS trail if a tripId is present.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { upsertRiderLocation, recordGpsPoint } from "@/lib/geo/queries";
import { getSocketServer } from "@/lib/websocket/server";
import { RiderStatus } from "@/app/generated/prisma/client";

interface LocationPoint {
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  accuracy?: number;
  ts: number; // Unix ms
  tripId?: string;
}

export async function PUT(req: NextRequest) {
  let user;
  try {
    user = await requireUser(req);
  } catch (err) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "RIDER") {
    return NextResponse.json({ error: "Riders only" }, { status: 403 });
  }

  const { points } = (await req.json()) as { points: LocationPoint[] };

  if (!Array.isArray(points) || points.length === 0) {
    return NextResponse.json({ error: "points array required" }, { status: 400 });
  }

  // Sort ascending by timestamp
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const latest = sorted[sorted.length - 1];

  // Upsert live position with the freshest point
  await upsertRiderLocation({
    riderId:  user.id,
    lat:      latest.lat,
    lng:      latest.lng,
    heading:  latest.heading,
    speedKmh: latest.speedKmh,
    accuracy: latest.accuracy,
    isOnline: true,
    status:   RiderStatus.AVAILABLE,
  });

  // Persist all points that have a tripId to the GPS trail
  const tripPoints = sorted.filter((p) => p.tripId);
  await Promise.all(
    tripPoints.map((p) =>
      recordGpsPoint({
        tripId:  p.tripId!,
        riderId: user.id,
        lat:     p.lat,
        lng:     p.lng,
        heading: p.heading,
        speedKmh: p.speedKmh,
      })
    )
  );

  // Fan out latest position via WebSocket if trip is active
  if (latest.tripId) {
    try {
      const io = getSocketServer();
      io.to(`trip:${latest.tripId}`).emit("rider:location:update", {
        tripId:   latest.tripId,
        riderId:  user.id,
        lat:      latest.lat,
        lng:      latest.lng,
        heading:  latest.heading,
        speedKmh: latest.speedKmh,
        ts:       latest.ts,
      });
    } catch {
      // Socket server may not be running in this serverless instance — OK
    }
  }

  return NextResponse.json({ processed: sorted.length });
}
