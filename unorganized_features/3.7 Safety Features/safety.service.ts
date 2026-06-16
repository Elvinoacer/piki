// lib/safety/safety.service.ts
// Server-side business logic for all safety features.

import { prisma } from "@/lib/prisma";
import type {
  TriggerSosInput,
  SubmitRatingInput,
  SubmitReportInput,
  AddTrustedContactInput,
} from "@/types/safety";

// ─────────────────────────────────────────────────────────────────────────────
// SOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates an active SOS event and returns it with the user's trusted contacts.
 * Callers (API route / Server Action) are responsible for firing
 * the real-time notification & SMS after this resolves.
 */
export async function triggerSos(userId: string, input: TriggerSosInput) {
  const [sosEvent, trustedContacts] = await Promise.all([
    prisma.sosEvent.create({
      data: {
        userId,
        tripId: input.tripId ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        status: "ACTIVE",
      },
    }),
    prisma.trustedContact.findMany({ where: { userId } }),
  ]);
  return { sosEvent, trustedContacts };
}

export async function resolveSos(sosEventId: string, adminId: string) {
  return prisma.sosEvent.update({
    where: { id: sosEventId },
    data: { status: "RESOLVED", resolvedBy: adminId, resolvedAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip Share
// ─────────────────────────────────────────────────────────────────────────────

/** Creates (or refreshes) a shareable link for a trip. TTL: 24 h. */
export async function createTripShareLink(tripId: string) {
  // Invalidate any existing link for this trip so only one is live at a time.
  await prisma.tripShareLink.deleteMany({ where: { tripId } });

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return prisma.tripShareLink.create({
    data: { tripId, expiresAt },
  });
}

/** Returns the public trip view for an unauthenticated share-link visitor. */
export async function getTripSharePublicView(token: string) {
  const link = await prisma.tripShareLink.findUnique({
    where: { token },
    include: {
      trip: {
        include: {
          rider: {
            include: { riderProfile: true },
          },
        },
      },
    },
  });

  if (!link || link.expiresAt < new Date()) return null;

  const { trip } = link;
  const profile = trip.rider?.riderProfile;

  return {
    tripId: trip.id,
    status: trip.status,
    riderName: trip.rider?.name ?? "Rider",
    riderPhoto: profile?.photoUrl ?? null,
    riderPlate: profile?.plateNumber ?? "",
    riderRating: profile?.rating ?? 0,
    pickup: {
      lat: trip.pickupLat,
      lng: trip.pickupLng,
      address: trip.pickupAddress,
    },
    dropoff: {
      lat: trip.dropoffLat,
      lng: trip.dropoffLng,
      address: trip.dropoffAddress,
    },
    riderLat: profile?.currentLat ?? undefined,
    riderLng: profile?.currentLng ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GPS Trail Recording
// ─────────────────────────────────────────────────────────────────────────────

export async function recordTrailPoints(
  tripId: string,
  points: Array<{ latitude: number; longitude: number }>
) {
  const now = new Date();
  return prisma.tripTrailPoint.createMany({
    data: points.map((p) => ({ tripId, ...p, recordedAt: now })),
    skipDuplicates: true,
  });
}

export async function getTripTrail(tripId: string) {
  return prisma.tripTrailPoint.findMany({
    where: { tripId },
    orderBy: { recordedAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rider Identity Badge
// ─────────────────────────────────────────────────────────────────────────────

export async function getRiderIdentityBadge(riderId: string) {
  const profile = await prisma.riderProfile.findUnique({
    where: { userId: riderId },
    include: { user: { select: { name: true } } },
  });
  if (!profile) return null;

  const ratingCount = await prisma.rating.count({
    where: { toUserId: riderId, direction: "CLIENT_TO_RIDER" },
  });

  const badges: string[] = [];
  if (profile.isVerified) badges.push("Verified");
  if (profile.rating >= 4.8) badges.push("Top Rated");
  if (profile.saccoId) badges.push("SACCO Certified");

  return {
    riderId,
    name: profile.user.name,
    photo: profile.photoUrl,
    plateNumber: profile.plateNumber,
    rating: profile.rating,
    ratingCount,
    isVerified: profile.isVerified,
    badges,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ratings & Reviews
// ─────────────────────────────────────────────────────────────────────────────

export async function submitRating(fromUserId: string, input: SubmitRatingInput) {
  if (input.score < 1 || input.score > 5) {
    throw new Error("Score must be between 1 and 5.");
  }

  const rating = await prisma.rating.create({
    data: {
      tripId: input.tripId,
      fromUserId,
      toUserId: input.toUserId,
      score: input.score,
      tags: input.tags,
      comment: input.comment ?? null,
      direction: input.direction,
      flagged: input.score <= 2, // auto-flag low scores for admin review
    },
  });

  // Recompute recipient's aggregate rating.
  await recomputeUserRating(input.toUserId);

  return rating;
}

async function recomputeUserRating(userId: string) {
  const agg = await prisma.rating.aggregate({
    where: { toUserId: userId },
    _avg: { score: true },
  });
  const avg = agg._avg.score ?? 0;

  // Update whichever profile exists for this user.
  await Promise.allSettled([
    prisma.riderProfile.updateMany({
      where: { userId },
      data: { rating: avg },
    }),
    prisma.clientProfile.updateMany({
      where: { userId },
      data: { rating: avg },
    }),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Report & Block
// ─────────────────────────────────────────────────────────────────────────────

export async function submitReport(reporterId: string, input: SubmitReportInput) {
  return prisma.report.create({
    data: {
      reporterId,
      reportedId: input.reportedId,
      tripId: input.tripId ?? null,
      reason: input.reason,
      description: input.description ?? null,
      status: "PENDING",
    },
  });
}

export async function blockUser(blockerId: string, blockedId: string) {
  return prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    create: { blockerId, blockedId },
    update: {},
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return prisma.block.deleteMany({ where: { blockerId, blockedId } });
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });
  return !!block;
}

// ─────────────────────────────────────────────────────────────────────────────
// Trusted Contacts
// ─────────────────────────────────────────────────────────────────────────────

export async function getTrustedContacts(userId: string) {
  return prisma.trustedContact.findMany({ where: { userId } });
}

export async function addTrustedContact(userId: string, input: AddTrustedContactInput) {
  return prisma.trustedContact.upsert({
    where: { userId_phone: { userId, phone: input.phone } },
    create: { userId, name: input.name, phone: input.phone },
    update: { name: input.name },
  });
}

export async function removeTrustedContact(userId: string, contactId: string) {
  return prisma.trustedContact.delete({
    where: { id: contactId, userId },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Night Check-ins
// ─────────────────────────────────────────────────────────────────────────────

const NIGHT_HOUR_START = 21; // 9 PM
const NIGHT_HOUR_END = 5;    // 5 AM

export function isNightHour(): boolean {
  const h = new Date().getHours();
  return h >= NIGHT_HOUR_START || h < NIGHT_HOUR_END;
}

export async function createNightCheckIn(tripId: string, userId: string) {
  return prisma.nightCheckIn.create({
    data: { tripId, userId, status: "PENDING" },
  });
}

export async function respondToCheckIn(checkInId: string) {
  return prisma.nightCheckIn.update({
    where: { id: checkInId },
    data: { status: "SAFE", respondedAt: new Date() },
  });
}

/**
 * Called by a background job (BullMQ) ~5 minutes after check-in is sent.
 * Marks unanswered check-ins as NO_RESPONSE and returns them for escalation.
 */
export async function flagUnansweredCheckIns() {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stale = await prisma.nightCheckIn.findMany({
    where: { status: "PENDING", sentAt: { lt: cutoff } },
  });

  if (stale.length > 0) {
    await prisma.nightCheckIn.updateMany({
      where: { id: { in: stale.map((c) => c.id) } },
      data: { status: "NO_RESPONSE" },
    });
  }

  return stale;
}
