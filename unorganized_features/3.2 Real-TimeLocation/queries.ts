/**
 * lib/geo/queries.ts
 *
 * PostGIS raw SQL helpers via Prisma.$queryRaw
 * All distance calculations use geography type (metres on Earth's surface).
 *
 * Requires: CREATE EXTENSION IF NOT EXISTS postgis;
 */

import { prisma } from "@/lib/prisma";
import { RiderStatus } from "@prisma/client";

export interface NearbyRider {
  riderId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  distanceMetres: number;
  rating: number;
  acceptanceRate: number;
  idleSeconds: number; // seconds since last trip ended
}

/**
 * Find online+available riders within `radiusKm` of a point.
 * Returns them pre-scored for the matching algorithm.
 */
export async function findNearbyRiders(
  lat: number,
  lng: number,
  radiusKm: number,
  limit = 10
): Promise<NearbyRider[]> {
  const radiusMetres = radiusKm * 1000;

  const rows = await prisma.$queryRaw<NearbyRider[]>`
    SELECT
      rl.rider_id                                              AS "riderId",
      rl.latitude,
      rl.longitude,
      rl.heading,
      ST_Distance(
        rl.location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      )                                                        AS "distanceMetres",
      COALESCE(rp.rating, 5.0)                                AS rating,
      COALESCE(rp.acceptance_rate, 1.0)                       AS "acceptanceRate",
      COALESCE(
        EXTRACT(EPOCH FROM (NOW() - rp.last_trip_ended_at)),
        999999
      )                                                        AS "idleSeconds"
    FROM rider_locations rl
    JOIN rider_profiles rp ON rp.user_id = rl.rider_id
    WHERE
      rl.is_online = TRUE
      AND rl.status = ${RiderStatus.AVAILABLE}::"RiderStatus"
      AND rl.location IS NOT NULL
      AND ST_DWithin(
            rl.location,
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
            ${radiusMetres}
          )
    ORDER BY "distanceMetres" ASC
    LIMIT ${limit}
  `;

  return rows;
}

/**
 * Upsert a rider's live location.
 * Uses Unsupported PostGIS column via raw SQL fragment.
 */
export async function upsertRiderLocation(opts: {
  riderId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  accuracy?: number;
  isOnline: boolean;
  status: RiderStatus;
}): Promise<void> {
  const { riderId, lat, lng, heading, speedKmh, accuracy, isOnline, status } =
    opts;

  await prisma.$executeRaw`
    INSERT INTO rider_locations (
      id, rider_id, location, latitude, longitude,
      heading, speed_kmh, accuracy, is_online, status, updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${riderId},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${lat}, ${lng},
      ${heading ?? null}, ${speedKmh ?? null}, ${accuracy ?? null},
      ${isOnline}, ${status}::"RiderStatus",
      NOW()
    )
    ON CONFLICT (rider_id) DO UPDATE SET
      location    = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      latitude    = ${lat},
      longitude   = ${lng},
      heading     = ${heading ?? null},
      speed_kmh   = ${speedKmh ?? null},
      accuracy    = ${accuracy ?? null},
      is_online   = ${isOnline},
      status      = ${status}::"RiderStatus",
      updated_at  = NOW()
  `;
}

/**
 * Find which Zone a point falls inside (for pricing & dispatch config).
 * Returns null if outside all active zones (service unavailable).
 */
export async function getZoneForPoint(
  lat: number,
  lng: number
): Promise<{ id: string; name: string; county: string } | null> {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; county: string }[]
  >`
    SELECT id, name, county
    FROM zones
    WHERE
      status = 'ACTIVE'
      AND boundary IS NOT NULL
      AND ST_Within(
            ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography::geometry,
            boundary::geometry
          )
    LIMIT 1
  `;

  return rows[0] ?? null;
}

/**
 * Persist a GPS breadcrumb to the trip trail.
 */
export async function recordGpsPoint(opts: {
  tripId: string;
  riderId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
}): Promise<void> {
  await prisma.tripGpsPoint.create({
    data: {
      tripId: opts.tripId,
      riderId: opts.riderId,
      lat: opts.lat,
      lng: opts.lng,
      heading: opts.heading,
      speedKmh: opts.speedKmh,
      recordedAt: new Date(),
    },
  });
}
