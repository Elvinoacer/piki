// lib/api/riderDashboard.ts
// Server-side Prisma queries powering the Rider Dashboard (PRD §3.9)
// All functions are async and run in Next.js Server Components / Route Handlers.

import { prisma } from "@/lib/prisma"; // your existing prisma client singleton
import type {
  RiderDashboardData,
  EarningsSummary,
  TripHistoryItem,
  PerformanceStats,
  RiderDocument,
  HeatmapPoint,
  RiderProfile,
  WalletBalance,
  PayoutRequest,
} from "@/types/rider-dashboard";

// ─── Full dashboard fetch (used on initial page load / SSR) ─────────────────

export async function getRiderDashboardData(
  riderId: string
): Promise<RiderDashboardData> {
  const [
    riderRaw,
    earnings,
    tripHistory,
    payouts,
    walletRaw,
    performance,
    documents,
    heatmapPoints,
  ] = await Promise.all([
    fetchRiderProfile(riderId),
    fetchEarningsSummary(riderId),
    fetchTripHistory(riderId, { page: 1, pageSize: 20 }),
    fetchPayouts(riderId),
    fetchWalletBalance(riderId),
    fetchPerformanceStats(riderId),
    fetchDocuments(riderId),
    fetchHeatmapPoints(),
  ]);

  return {
    rider: riderRaw,
    earnings,
    tripHistory: tripHistory.items,
    payouts,
    wallet: walletRaw,
    performance,
    documents,
    heatmapPoints,
  };
}

// ─── Rider profile ───────────────────────────────────────────────────────────

export async function fetchRiderProfile(riderId: string): Promise<RiderProfile> {
  const profile = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    include: {
      user: true,
      sacco: { select: { name: true } },
    },
  });

  return {
    id: profile.id,
    name: profile.user.name,
    phone: profile.user.phone,
    avatarUrl: profile.user.avatarUrl,
    status: profile.status as RiderProfile["status"],
    rating: profile.rating,
    badges: deriveRiderBadges(profile),
    plateNumber: profile.plateNumber,
    saccoName: profile.sacco?.name ?? null,
  };
}

function deriveRiderBadges(profile: {
  isVerified: boolean;
  rating: number;
  totalTrips: number;
}): string[] {
  const badges: string[] = [];
  if (profile.isVerified) badges.push("Verified");
  if (profile.rating >= 4.8 && profile.totalTrips >= 50) badges.push("Top Rated");
  if (profile.totalTrips >= 100) badges.push("Century Rider");
  return badges;
}

// ─── Earnings summary ────────────────────────────────────────────────────────

export async function fetchEarningsSummary(
  riderId: string
): Promise<EarningsSummary> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const trips = await prisma.trip.findMany({
    where: {
      riderId,
      status: "COMPLETED",
      completedAt: { gte: startOfMonth },
    },
    include: {
      ratings: { where: { raterId: { not: riderId } } }, // ratings from client
    },
    orderBy: { completedAt: "desc" },
  });

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  const earningTrips = trips.map((t) => {
    const net = t.netFare;
    const completedAt = t.completedAt!;
    if (completedAt >= startOfDay) today += net;
    if (completedAt >= startOfWeek) thisWeek += net;
    thisMonth += net;

    const clientRating = t.ratings[0]?.score ?? null;

    return {
      tripId: t.id,
      completedAt: completedAt.toISOString(),
      pickupAddress: t.pickupAddress,
      dropoffAddress: t.dropoffAddress,
      tripType: t.tripType as any,
      grossFare: t.grossFare,
      commission: t.commission,
      net,
      paymentMethod: t.paymentMethod as any,
      clientName: t.clientName,
      clientRating,
    };
  });

  // Pending payout = wallet pending balance
  const wallet = await prisma.wallet.findUnique({
    where: { userId: (await prisma.riderProfile.findUniqueOrThrow({ where: { id: riderId }, select: { userId: true } })).userId },
    select: { pending: true },
  });

  return {
    today,
    thisWeek,
    thisMonth,
    pendingPayout: wallet?.pending ?? 0,
    trips: earningTrips,
  };
}

// ─── Trip history ────────────────────────────────────────────────────────────

export async function fetchTripHistory(
  riderId: string,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number }
): Promise<{ items: TripHistoryItem[]; hasMore: boolean }> {
  const skip = (page - 1) * pageSize;

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where: { riderId },
      include: {
        ratings: { where: { raterId: { not: riderId } } },
      },
      orderBy: { requestedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.trip.count({ where: { riderId } }),
  ]);

  const items: TripHistoryItem[] = trips.map((t) => {
    const rating = t.ratings[0];
    return {
      id: t.id,
      status: t.status as any,
      tripType: t.tripType as any,
      pickupAddress: t.pickupAddress,
      dropoffAddress: t.dropoffAddress,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      fare: t.netFare,
      paymentMethod: t.paymentMethod as any,
      clientName: t.clientName,
      clientAvatar: t.clientAvatar,
      ratingReceived: rating?.score ?? null,
      ratingComment: rating?.comment ?? null,
      distanceKm: t.distanceKm,
    };
  });

  return { items, hasMore: skip + pageSize < total };
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export async function fetchPayouts(riderId: string): Promise<PayoutRequest[]> {
  const payouts = await prisma.payout.findMany({
    where: { riderId },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });

  return payouts.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status as any,
    requestedAt: p.requestedAt.toISOString(),
    processedAt: p.processedAt?.toISOString() ?? null,
    mpesaRef: p.mpesaRef,
    phoneNumber: p.phoneNumber,
  }));
}

// ─── Wallet balance ───────────────────────────────────────────────────────────

export async function fetchWalletBalance(
  riderId: string
): Promise<WalletBalance> {
  const profile = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    select: { userId: true },
  });
  const wallet = await prisma.wallet.findUnique({
    where: { userId: profile.userId },
    select: { balance: true, pending: true },
  });
  return { available: wallet?.balance ?? 0, pending: wallet?.pending ?? 0 };
}

// ─── Performance stats ────────────────────────────────────────────────────────

export async function fetchPerformanceStats(
  riderId: string
): Promise<PerformanceStats> {
  const profile = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    select: {
      acceptanceRate: true,
      completionRate: true,
      rating: true,
      totalDistanceKm: true,
      totalTrips: true,
    },
  });

  // All-time earnings
  const earningsAgg = await prisma.trip.aggregate({
    where: { riderId, status: "COMPLETED" },
    _sum: { netFare: true },
  });

  return {
    acceptanceRate: Math.round(profile.acceptanceRate),
    completionRate: Math.round(profile.completionRate),
    averageRating: Math.round(profile.rating * 10) / 10,
    totalDistanceKm: Math.round(profile.totalDistanceKm),
    totalTrips: profile.totalTrips,
    totalEarningsAllTime: earningsAgg._sum.netFare ?? 0,
  };
}

// ─── Documents ────────────────────────────────────────────────────────────────

const DOCUMENT_LABELS: Record<string, string> = {
  NATIONAL_ID: "National ID",
  DRIVING_LICENSE: "Driving License",
  PSV_BADGE: "PSV / NTSA Badge",
  LOGBOOK: "Motorcycle Logbook",
  INSURANCE: "Insurance Certificate",
};

export async function fetchDocuments(
  riderId: string
): Promise<RiderDocument[]> {
  const docs = await prisma.document.findMany({
    where: { riderId },
    orderBy: { type: "asc" },
  });

  const now = new Date();

  return docs.map((d) => {
    let daysUntilExpiry: number | null = null;
    if (d.expiryDate) {
      const diff = d.expiryDate.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return {
      id: d.id,
      type: d.type as any,
      label: DOCUMENT_LABELS[d.type] ?? d.type,
      expiryDate: d.expiryDate?.toISOString() ?? null,
      daysUntilExpiry,
      verificationStatus: d.verificationStatus as any,
      fileUrl: d.fileUrl,
    };
  });
}

// ─── Heatmap data ─────────────────────────────────────────────────────────────
// Returns the last 24 hrs of trip pickup locations as weighted points.
// Uses raw SQL for PostGIS compatibility.

export async function fetchHeatmapPoints(): Promise<HeatmapPoint[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Cluster pickups into ~200m grid cells and return count as weight
  const rows = await prisma.$queryRaw<
    { lat: number; lng: number; cnt: bigint }[]
  >`
    SELECT
      ROUND(CAST("pickupLat" AS NUMERIC), 3)  AS lat,
      ROUND(CAST("pickupLng" AS NUMERIC), 3)  AS lng,
      COUNT(*)                                  AS cnt
    FROM "Trip"
    WHERE "requestedAt" >= ${since}
      AND "status" IN ('COMPLETED', 'ACCEPTED', 'IN_PROGRESS')
    GROUP BY 1, 2
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
    LIMIT 500
  `;

  const maxCnt = Math.max(1, ...rows.map((r) => Number(r.cnt)));

  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    weight: Number(r.cnt) / maxCnt,
  }));
}
