// src/lib/sacco/queries.ts
// All Prisma queries for the SACCO module — used by Route Handlers & Server Actions

import prisma from "@/lib/prisma"; // your existing singleton
import { addDays, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import type {
  FleetAnalyticsDTO,
  SaccoRiderDTO,
  ComplianceRiderDTO,
  RiderPayoutDTO,
  TopPerformerDTO,
  ZoneDTO,
  SaccoPayoutBatchDTO,
  CommissionRuleDTO,
} from "@/types/sacco";

// ── Helpers ──────────────────────────────────────────────────

function periodStart(period: "today" | "week" | "month"): Date {
  const now = new Date();
  if (period === "today") return startOfDay(now);
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 });
  return startOfMonth(now);
}

// ── Fleet analytics ──────────────────────────────────────────

export async function getFleetAnalytics(
  saccoId: string,
  period: "today" | "week" | "month"
): Promise<FleetAnalyticsDTO> {
  const since = periodStart(period);

  const [riderRows, tripRows, onlineCount, expiringDocs, expiredDocs] =
    await Promise.all([
      // all active riders in this SACCO
      prisma.riderProfile.findMany({
        where: { saccoId, saccoStatus: "ACTIVE" },
        select: { id: true, onlineStatus: true },
      }),

      // completed trips in period
      prisma.trip.findMany({
        where: {
          riderProfile: { saccoId },
          status: "COMPLETED",
          completedAt: { gte: since },
        },
        select: {
          id: true,
          fareTotal: true,
          commissionAmount: true,
          riderProfileId: true,
          riderProfile: {
            select: {
              id: true,
              user: { select: { fullName: true, avatarUrl: true } },
              rating: true,
            },
          },
        },
      }),

      prisma.riderProfile.count({
        where: { saccoId, saccoStatus: "ACTIVE", onlineStatus: true },
      }),

      // documents expiring in next 30 days
      prisma.document.count({
        where: {
          riderProfile: { saccoId, saccoStatus: "ACTIVE" },
          verificationStatus: "APPROVED",
          expiryDate: {
            gte: new Date(),
            lte: addDays(new Date(), 30),
          },
        },
      }),

      // already expired
      prisma.document.count({
        where: {
          riderProfile: { saccoId, saccoStatus: "ACTIVE" },
          verificationStatus: "EXPIRED",
        },
      }),
    ]);

  const totalRevenue = tripRows.reduce(
    (s, t) => s + Number(t.fareTotal ?? 0),
    0
  );
  const totalCommission = tripRows.reduce(
    (s, t) => s + Number(t.commissionAmount ?? 0),
    0
  );

  // Top performers: aggregate trips per rider
  const riderMap = new Map<
    string,
    { name: string; avatar: string | null; trips: number; earnings: number; rating: number }
  >();
  for (const t of tripRows) {
    const rid = t.riderProfileId;
    if (!rid) continue;
    const prev = riderMap.get(rid) ?? {
      name: t.riderProfile?.user?.fullName ?? "Unknown",
      avatar: t.riderProfile?.user?.avatarUrl ?? null,
      trips: 0,
      earnings: 0,
      rating: Number(t.riderProfile?.rating ?? 0),
    };
    riderMap.set(rid, {
      ...prev,
      trips: prev.trips + 1,
      earnings: prev.earnings + Number(t.fareTotal ?? 0),
    });
  }

  const topPerformers: TopPerformerDTO[] = Array.from(riderMap.entries())
    .sort((a, b) => b[1].trips - a[1].trips)
    .slice(0, 5)
    .map(([id, v]) => ({
      riderProfileId: id,
      riderName: v.name,
      avatarUrl: v.avatar,
      tripsCompleted: v.trips,
      earnings: v.earnings.toFixed(2),
      rating: v.rating.toFixed(1),
    }));

  return {
    period,
    activeRiders: riderRows.length,
    onlineNow: onlineCount,
    tripsCompleted: tripRows.length,
    totalRevenue: totalRevenue.toFixed(2),
    totalCommissionEarned: totalCommission.toFixed(2),
    topPerformers,
    documentsExpiringSoon: expiringDocs,
    documentsExpired: expiredDocs,
  };
}

// ── Rider roster ─────────────────────────────────────────────

export async function getSaccoRiders(saccoId: string): Promise<SaccoRiderDTO[]> {
  const riders = await prisma.riderProfile.findMany({
    where: { saccoId },
    include: {
      user: { select: { fullName: true, phone: true, avatarUrl: true } },
      zoneAssignments: {
        where: { removedAt: null },
        include: { zone: { select: { name: true } } },
      },
      commissionRules: {
        where: {
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          riderProfileId: { not: null },
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
      documents: {
        select: {
          expiryDate: true,
          verificationStatus: true,
        },
      },
      _count: { select: { trips: { where: { status: "COMPLETED" } } } },
    },
    orderBy: { saccoJoinedAt: "asc" },
  });

  return riders.map((r) => {
    const expiringSoon = r.documents.filter((d) => {
      if (!d.expiryDate) return false;
      return (
        d.verificationStatus === "APPROVED" &&
        d.expiryDate <= addDays(new Date(), 30)
      );
    }).length;

    const rule = r.commissionRules[0] ?? null;

    return {
      id: r.id,
      userId: r.userId,
      fullName: r.user.fullName,
      phone: r.user.phone,
      avatarUrl: r.user.avatarUrl,
      vehiclePlate: r.vehiclePlate,
      rating: String(r.rating ?? "0.0"),
      saccoStatus: r.saccoStatus,
      saccoJoinedAt: r.saccoJoinedAt?.toISOString() ?? null,
      onlineStatus: r.onlineStatus,
      tripCount: r._count.trips,
      totalEarnings: "0.00", // extend: sum wallet credits tied to SACCO trips
      activeZones: r.zoneAssignments.map((za) => za.zone.name),
      documentsExpiringSoon: expiringSoon,
      commissionOverride: rule
        ? {
            id: rule.id,
            saccoId: rule.saccoId,
            riderProfileId: rule.riderProfileId,
            platformCommissionPct: String(rule.platformCommissionPct),
            saccoCommissionPct: String(rule.saccoCommissionPct),
            effectiveFrom: rule.effectiveFrom.toISOString(),
            effectiveTo: rule.effectiveTo?.toISOString() ?? null,
            note: rule.note,
          }
        : null,
    };
  });
}

// ── Compliance report ─────────────────────────────────────────

export async function getComplianceReport(
  saccoId: string
): Promise<ComplianceRiderDTO[]> {
  const riders = await prisma.riderProfile.findMany({
    where: { saccoId, saccoStatus: "ACTIVE" },
    include: {
      user: { select: { fullName: true, phone: true, avatarUrl: true } },
      documents: {
        select: {
          id: true,
          type: true,
          verificationStatus: true,
          expiryDate: true,
        },
      },
    },
  });

  return riders.map((r) => {
    const docs = r.documents.map((d) => {
      const daysUntil = d.expiryDate
        ? Math.floor(
            (d.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null;
      return {
        id: d.id,
        type: d.type,
        verificationStatus: d.verificationStatus as ComplianceRiderDTO["documents"][number]["verificationStatus"],
        expiryDate: d.expiryDate?.toISOString() ?? null,
        daysUntilExpiry: daysUntil,
      };
    });

    const hasExpired = docs.some((d) => d.verificationStatus === "EXPIRED");
    const hasExpiringSoon = docs.some(
      (d) => d.daysUntilExpiry !== null && d.daysUntilExpiry <= 30 && d.daysUntilExpiry >= 0
    );
    const hasMissing =
      docs.length < 4; // expected: ID, license, logbook, insurance

    let overallStatus: ComplianceRiderDTO["overallStatus"] = "COMPLIANT";
    if (hasMissing) overallStatus = "MISSING";
    else if (hasExpired) overallStatus = "EXPIRED";
    else if (hasExpiringSoon) overallStatus = "EXPIRING_SOON";

    return {
      riderProfileId: r.id,
      riderName: r.user.fullName,
      phone: r.user.phone,
      avatarUrl: r.user.avatarUrl,
      documents: docs,
      overallStatus,
    };
  });
}

// ── Zones ─────────────────────────────────────────────────────

export async function getSaccoZones(saccoId: string): Promise<ZoneDTO[]> {
  const zones = await prisma.zone.findMany({
    include: {
      zoneAssignments: {
        where: {
          saccoId,
          removedAt: null,
        },
        select: { id: true },
      },
    },
  });

  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    riderCount: z.zoneAssignments.length,
  }));
}

// ── Payout helpers ────────────────────────────────────────────

export async function getRidersPendingPayout(
  saccoId: string
): Promise<RiderPayoutDTO[]> {
  const riders = await prisma.riderProfile.findMany({
    where: { saccoId, saccoStatus: "ACTIVE" },
    include: {
      user: { select: { fullName: true, phone: true } },
      wallet: { select: { balance: true } },
      payouts: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return riders
    .filter((r) => Number(r.wallet?.balance ?? 0) > 0)
    .map((r) => ({
      riderId: r.id,
      riderName: r.user.fullName,
      phone: r.user.phone,
      pendingEarnings: String(r.wallet?.balance ?? "0.00"),
      lastPayoutDate: r.payouts[0]?.createdAt.toISOString() ?? null,
    }));
}

export async function getSaccoPayoutBatches(
  saccoId: string
): Promise<SaccoPayoutBatchDTO[]> {
  const batches = await prisma.saccoPayoutBatch.findMany({
    where: { saccoId },
    include: { _count: { select: { payouts: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return batches.map((b) => ({
    id: b.id,
    saccoId: b.saccoId,
    initiatedBy: b.initiatedBy,
    totalAmount: String(b.totalAmount),
    status: b.status,
    mpesaB2CRef: b.mpesaB2CRef,
    note: b.note,
    createdAt: b.createdAt.toISOString(),
    processedAt: b.processedAt?.toISOString() ?? null,
    payoutCount: b._count.payouts,
  }));
}
