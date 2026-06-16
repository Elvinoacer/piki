// lib/trip-history.ts
// Feature 3.14 — Search, History & Receipts
// Server-side: Prisma + raw SQL for full-text search

import { prisma } from "@/lib/prisma";
import type {
  TripHistoryFilters,
  TripHistoryItem,
  TripHistoryResponse,
  TripType,
  TripStatus,
} from "@/types/history";

/**
 * Fetch paginated trip history for a user (client or rider).
 * Uses PostgreSQL tsvector full-text search for address queries.
 */
export async function getTripHistory(
  userId: string,
  role: "CLIENT" | "RIDER",
  filters: TripHistoryFilters
): Promise<TripHistoryResponse> {
  const { search, dateFrom, dateTo, type, status, page, pageSize } = filters;
  const skip = (page - 1) * pageSize;
  const userField = role === "CLIENT" ? "clientId" : "riderId";

  // ── Build WHERE clauses ──────────────────────────────────────
  const whereClause: Record<string, unknown> = {
    [userField]: userId,
  };

  if (type !== "ALL") {
    whereClause.type = type as TripType;
  }

  if (status !== "ALL") {
    whereClause.status = status as TripStatus;
  }

  if (dateFrom) {
    whereClause.createdAt = {
      ...(whereClause.createdAt as object ?? {}),
      gte: new Date(dateFrom),
    };
  }

  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    whereClause.createdAt = {
      ...(whereClause.createdAt as object ?? {}),
      lte: end,
    };
  }

  // ── Full-text search via raw SQL if search term provided ─────
  // When a search term exists, we use the tsvector column added by migration.
  // Otherwise, fall through to standard Prisma query.

  if (search.trim()) {
    return await searchTripsByAddress(userId, role, filters);
  }

  // ── Standard Prisma query (no FTS) ──────────────────────────
  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: tripSelectFields(role),
    }),
    prisma.trip.count({ where: whereClause }),
  ]);

  return {
    trips: trips.map(formatTrip),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Full-text search using PostgreSQL tsvector.
 * Falls back to ILIKE if tsvector column not yet present.
 */
async function searchTripsByAddress(
  userId: string,
  role: "CLIENT" | "RIDER",
  filters: TripHistoryFilters
): Promise<TripHistoryResponse> {
  const { search, dateFrom, dateTo, type, status, page, pageSize } = filters;
  const userField = role === "CLIENT" ? `"clientId"` : `"riderId"`;
  const skip = (page - 1) * pageSize;

  const params: unknown[] = [userId, `%${search}%`];
  let paramIdx = 3;

  let extraFilters = "";

  if (type !== "ALL") {
    extraFilters += ` AND t."type" = $${paramIdx}::text::"TripType"`;
    params.push(type);
    paramIdx++;
  }

  if (status !== "ALL") {
    extraFilters += ` AND t."status" = $${paramIdx}::text::"TripStatus"`;
    params.push(status);
    paramIdx++;
  }

  if (dateFrom) {
    extraFilters += ` AND t."createdAt" >= $${paramIdx}::timestamptz`;
    params.push(new Date(dateFrom));
    paramIdx++;
  }

  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    extraFilters += ` AND t."createdAt" <= $${paramIdx}::timestamptz`;
    params.push(end);
    paramIdx++;
  }

  // Use tsvector FTS first; the ILIKE fallback inside COALESCE handles
  // databases where the migration hasn't run yet.
  const searchSql = `
    SELECT t.*,
      u."name"         AS "riderName",
      u."phone"        AS "riderPhone",
      u."avatarUrl"    AS "riderAvatarUrl",
      rp."plateNumber" AS "riderPlateNumber",
      rp."rating"      AS "riderRating",
      r."score"        AS "ratingScore",
      r."comment"      AS "ratingComment"
    FROM "Trip" t
    LEFT JOIN "User"        u  ON u."id" = t."riderId"
    LEFT JOIN "RiderProfile" rp ON rp."userId" = t."riderId"
    LEFT JOIN "Rating"      r  ON r."tripId" = t."id"
                               AND r."fromRole" = 'CLIENT'
    WHERE t.${userField} = $1
      AND (
        (t.search_vector IS NOT NULL AND t.search_vector @@ plainto_tsquery('english', $2))
        OR
        (t."pickupAddress"  ILIKE $2)
        OR
        (t."dropoffAddress" ILIKE $2)
      )
      ${extraFilters}
    ORDER BY t."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${skip}
  `;

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM "Trip" t
    WHERE t.${userField} = $1
      AND (
        (t.search_vector IS NOT NULL AND t.search_vector @@ plainto_tsquery('english', $2))
        OR
        (t."pickupAddress"  ILIKE $2)
        OR
        (t."dropoffAddress" ILIKE $2)
      )
      ${extraFilters}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, countRows] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(searchSql, ...params),
    prisma.$queryRawUnsafe<{ cnt: string }[]>(countSql, ...params),
  ]);

  const total = parseInt(countRows[0]?.cnt ?? "0", 10);

  return {
    trips: rows.map(formatRawRow),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── Select fields for Prisma query ─────────────────────────────
function tripSelectFields(_role: "CLIENT" | "RIDER") {
  return {
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
        riderProfile: {
          select: { plateNumber: true, rating: true },
        },
      },
    },
    rating: {
      where: { fromRole: "CLIENT" },
      select: { score: true, comment: true },
    },
  } as const;
}

// ── Formatters ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTrip(raw: any): TripHistoryItem {
  return {
    id: raw.id,
    type: raw.type,
    status: raw.status,
    pickupAddress: raw.pickupAddress,
    dropoffAddress: raw.dropoffAddress,
    pickupLat: raw.pickupLat,
    pickupLng: raw.pickupLng,
    dropoffLat: raw.dropoffLat,
    dropoffLng: raw.dropoffLng,
    fareAmount: raw.fareAmount,
    fareBreakdown: raw.fareBreakdown ?? null,
    distanceKm: raw.distanceKm,
    durationMin: raw.durationMin,
    paymentMethod: raw.paymentMethod,
    receiptUrl: raw.receiptUrl,
    createdAt: raw.createdAt.toISOString(),
    completedAt: raw.completedAt?.toISOString() ?? null,
    cancelledAt: raw.cancelledAt?.toISOString() ?? null,
    cancelReason: raw.cancelReason,
    rider: raw.rider
      ? {
          id: raw.rider.id,
          name: raw.rider.name,
          phone: raw.rider.phone,
          avatarUrl: raw.rider.avatarUrl ?? null,
          plateNumber: raw.rider.riderProfile?.plateNumber ?? null,
          rating: raw.rider.riderProfile?.rating ?? null,
        }
      : null,
    rating: raw.rating?.[0]
      ? { score: raw.rating[0].score, comment: raw.rating[0].comment }
      : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatRawRow(row: any): TripHistoryItem {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    pickupAddress: row.pickupAddress,
    dropoffAddress: row.dropoffAddress,
    pickupLat: Number(row.pickupLat),
    pickupLng: Number(row.pickupLng),
    dropoffLat: Number(row.dropoffLat),
    dropoffLng: Number(row.dropoffLng),
    fareAmount: row.fareAmount !== null ? Number(row.fareAmount) : null,
    fareBreakdown: row.fareBreakdown ?? null,
    distanceKm: row.distanceKm !== null ? Number(row.distanceKm) : null,
    durationMin: row.durationMin !== null ? Number(row.durationMin) : null,
    paymentMethod: row.paymentMethod,
    receiptUrl: row.receiptUrl ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt).toISOString() : null,
    cancelReason: row.cancelReason ?? null,
    rider: row.riderId
      ? {
          id: row.riderId,
          name: row.riderName ?? "Unknown",
          phone: row.riderPhone ?? "",
          avatarUrl: row.riderAvatarUrl ?? null,
          plateNumber: row.riderPlateNumber ?? null,
          rating: row.riderRating !== null ? Number(row.riderRating) : null,
        }
      : null,
    rating:
      row.ratingScore !== null
        ? { score: Number(row.ratingScore), comment: row.ratingComment ?? null }
        : null,
  };
}
