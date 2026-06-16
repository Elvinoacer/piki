// lib/api/riderDashboard.ts
// Server-side Prisma queries powering the Rider Dashboard (PRD §3.9)
// All functions are async and run in Next.js Server Components / Route Handlers.

import { prisma } from "@/lib/prisma";
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
    name: `${profile.user.firstName ?? ""} ${profile.user.lastName ?? ""}`.trim() || "Rider",
    phone: profile.user.phone,
    avatarUrl: profile.user.avatarUrl,
    status: profile.availability as any,
    rating: profile.ratingAverage,
    badges: deriveRiderBadges(profile),
    plateNumber: profile.numberPlate ?? "",
    saccoName: profile.sacco?.name ?? null,
  };
}

function deriveRiderBadges(profile: {
  verificationStatus: string;
  ratingAverage: number;
  totalTrips: number;
}): string[] {
  const badges: string[] = [];
  if (profile.verificationStatus === "APPROVED") badges.push("Verified");
  if (profile.ratingAverage >= 4.8 && profile.totalTrips >= 50) badges.push("Top Rated");
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

  const profile = await prisma.riderProfile.findUniqueOrThrow({ where: { id: riderId }, select: { userId: true } });
  
  const trips = await prisma.trip.findMany({
    where: {
      riderId: profile.userId,
      status: "COMPLETED",
      tripEndedAt: { gte: startOfMonth },
    },
    include: {
      ratings: { where: { direction: "CLIENT_TO_RIDER" } },
      payment: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { tripEndedAt: "desc" },
  });

  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  const earningTrips = trips.map((t) => {
    const net = Number(t.payment?.riderEarning ?? t.fareFinal ?? 0);
    const completedAt = t.tripEndedAt!;
    if (completedAt >= startOfDay) today += net;
    if (completedAt >= startOfWeek) thisWeek += net;
    thisMonth += net;

    const clientRating = t.ratings[0]?.score ?? null;

    return {
      tripId: t.id,
      completedAt: completedAt.toISOString(),
      pickupAddress: t.pickupAddress,
      dropoffAddress: t.dropoffAddress ?? "Unknown",
      tripType: t.type as any,
      grossFare: Number(t.fareFinal ?? 0),
      commission: Number(t.payment?.commissionAmount ?? 0),
      net,
      paymentMethod: (t.payment?.method ?? "CASH") as any,
      clientName: `${t.client?.firstName ?? ""} ${t.client?.lastName ?? ""}`.trim() || "Client",
      clientRating,
    };
  });

  // Pending payout = wallet pending balance
  const wallet = await prisma.wallet.findUnique({
    where: { userId: profile.userId },
    select: { pending: true },
  });

  return {
    today,
    thisWeek,
    thisMonth,
    pendingPayout: Number(wallet?.pending ?? 0),
    trips: earningTrips,
  };
}

// ─── Trip history ────────────────────────────────────────────────────────────

export async function fetchTripHistory(
  riderId: string,
  { page = 1, pageSize = 20 }: { page?: number; pageSize?: number }
): Promise<{ items: TripHistoryItem[]; hasMore: boolean }> {
  const skip = (page - 1) * pageSize;
  const profile = await prisma.riderProfile.findUniqueOrThrow({ where: { id: riderId }, select: { userId: true } });

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where: { riderId: profile.userId },
      include: {
        ratings: { where: { direction: "CLIENT_TO_RIDER" } },
        payment: true,
        client: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.trip.count({ where: { riderId: profile.userId } }),
  ]);

  const items: TripHistoryItem[] = trips.map((t) => {
    const rating = t.ratings[0];
    return {
      id: t.id,
      status: t.status as any,
      tripType: t.type as any,
      pickupAddress: t.pickupAddress,
      dropoffAddress: t.dropoffAddress ?? "Unknown",
      startedAt: t.tripStartedAt?.toISOString() ?? null,
      completedAt: t.tripEndedAt?.toISOString() ?? null,
      fare: Number(t.fareFinal ?? 0),
      paymentMethod: (t.payment?.method ?? "CASH") as any,
      clientName: `${t.client?.firstName ?? ""} ${t.client?.lastName ?? ""}`.trim() || "Client",
      clientAvatar: t.client?.avatarUrl ?? null,
      ratingReceived: rating?.score ?? null,
      ratingComment: rating?.comment ?? null,
      distanceKm: t.distanceKm ?? 0,
    };
  });

  return { items, hasMore: skip + pageSize < total };
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export async function fetchPayouts(riderId: string): Promise<PayoutRequest[]> {
  const profile = await prisma.riderProfile.findUniqueOrThrow({ where: { id: riderId }, select: { userId: true } });

  const payouts = await prisma.payout.findMany({
    where: { riderId: profile.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return payouts.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status as any,
    requestedAt: p.createdAt.toISOString(),
    processedAt: p.processedAt?.toISOString() ?? null,
    mpesaRef: p.mpesaB2cRef ?? p.mpesaReceiptNumber ?? null,
    phoneNumber: p.mpesaPhone,
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
  return { available: Number(wallet?.balance ?? 0), pending: Number(wallet?.pending ?? 0) };
}

// ─── Performance stats ────────────────────────────────────────────────────────

export async function fetchPerformanceStats(
  riderId: string
): Promise<PerformanceStats> {
  const profile = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    select: {
      userId: true,
      acceptanceRate: true,
      completionRate: true,
      ratingAverage: true,
      totalDistanceKm: true,
      totalTrips: true,
    },
  });

  // All-time earnings
  const earningsAgg = await prisma.trip.aggregate({
    where: { riderId: profile.userId, status: "COMPLETED" },
    _sum: { fareFinal: true },
  });

  return {
    acceptanceRate: Math.round(profile.acceptanceRate),
    completionRate: Math.round(profile.completionRate),
    averageRating: Math.round(profile.ratingAverage * 10) / 10,
    totalDistanceKm: Math.round(profile.totalDistanceKm),
    totalTrips: profile.totalTrips,
    totalEarningsAllTime: Number(earningsAgg._sum.fareFinal ?? 0),
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
    if (d.expiresAt) {
      const diff = d.expiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return {
      id: d.id,
      type: d.type as any,
      label: DOCUMENT_LABELS[d.type] ?? d.type,
      expiryDate: d.expiresAt?.toISOString() ?? null,
      daysUntilExpiry,
      verificationStatus: d.status as any,
      fileUrl: d.fileKey, // Map fileKey to fileUrl for the UI
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
    FROM "trips"
    WHERE "createdAt" >= ${since}
      AND "status" IN ('COMPLETED', 'ACCEPTED', 'IN_PROGRESS')
    GROUP BY 1, 2
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
    LIMIT 500
  `;

  if (rows.length === 0) return [];

  const maxCnt = Math.max(1, ...rows.map((r) => Number(r.cnt)));

  return rows.map((r) => ({
    lat: Number(r.lat),
    lng: Number(r.lng),
    weight: Number(r.cnt) / maxCnt,
  }));
}
