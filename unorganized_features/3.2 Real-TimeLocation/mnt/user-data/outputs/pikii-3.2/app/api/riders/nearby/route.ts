/**
 * app/api/riders/nearby/route.ts
 *
 * GET /api/riders/nearby?lat=X&lng=Y&radius=3
 *
 * Returns nearby AVAILABLE riders for the client's map pre-booking view
 * (shows rider pins on map before a trip is requested).
 *
 * Intentionally returns limited fields — no PII exposed pre-match.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findNearbyRiders } from "@/lib/geo/queries";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lat    = parseFloat(searchParams.get("lat")    ?? "");
  const lng    = parseFloat(searchParams.get("lng")    ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "3");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const clampedRadius = Math.min(Math.max(radius, 0.5), 10); // 0.5 – 10 km

  const riders = await findNearbyRiders(lat, lng, clampedRadius, 20);

  // Return only what the map needs — no PII
  const pins = riders.map((r) => ({
    riderId:        r.riderId,
    lat:            r.latitude,
    lng:            r.longitude,
    heading:        r.heading,
    distanceMetres: Math.round(r.distanceMetres),
    rating:         r.rating,
  }));

  return NextResponse.json({ riders: pins });
}
