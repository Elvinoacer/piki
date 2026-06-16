"use server";
// src/lib/actions/ratings.actions.ts

import { prisma } from "@/lib/prisma";
import { getServerAuth } from "@/lib/auth/session";
import { recomputeRiderTrustScore } from "@/lib/trust-score";
import type {
  SubmitRatingPayload,
  SubmitDisputePayload,
  RatingResponse,
  DisputeResponse,
  RatingSummaryForTrip,
} from "@/types/ratings";

const MAX_RATING_WINDOW_HOURS = 72; // clients can rate up to 72h after trip completion

// ── Submit Rating ─────────────────────────────────────────────

export async function submitRating(
  payload: SubmitRatingPayload
): Promise<{ success: true; data: RatingResponse } | { success: false; error: string }> {
  const session = await getServerAuth();
  if (!session?.sub) return { success: false, error: "Unauthenticated" };
  const userId = session.sub;

  const { tripId, score, comment, tags = [] } = payload;

  if (score < 1 || score > 5) {
    return { success: false, error: "Score must be between 1 and 5" };
  }

  // Load trip and verify it's completed + caller was part of it
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { rider: true },
  });

  if (!trip) return { success: false, error: "Trip not found" };
  if (trip.status !== "COMPLETED") {
    return { success: false, error: "Can only rate completed trips" };
  }

  // Enforce rating window
  const cutoff = new Date(
    (trip.tripEndedAt ?? trip.updatedAt).getTime() +
      MAX_RATING_WINDOW_HOURS * 60 * 60 * 1000
  );
  if (new Date() > cutoff) {
    return { success: false, error: "Rating window has expired" };
  }

  const isClient = trip.clientId === userId;
  const isRider = trip.rider?.id === userId;

  if (!isClient && !isRider) {
    return { success: false, error: "You were not part of this trip" };
  }

  const direction = isClient ? "CLIENT_TO_RIDER" : "RIDER_TO_CLIENT";
  const toUserId = isClient ? trip.rider!.id : trip.clientId;

  // Check for duplicate rating in same direction
  const existing = await prisma.rating.findUnique({
    where: { tripId_direction: { tripId, direction } },
  });
  if (existing) {
    return { success: false, error: "You have already rated this trip" };
  }

  const rating = await prisma.rating.create({
    data: {
      tripId,
      fromUserId: userId,
      toUserId,
      direction,
      score,
      comment: comment?.trim() || null,
      tags,
    },
  });

  // If rider was rated → recompute their trust score asynchronously
  if (direction === "CLIENT_TO_RIDER" && trip.rider) {
    // Fire-and-forget; don't block the response
    recomputeRiderTrustScore(trip.rider.id).catch(console.error);
  }

  return {
    success: true,
    data: {
      id: rating.id,
      tripId: rating.tripId,
      direction: rating.direction as "CLIENT_TO_RIDER" | "RIDER_TO_CLIENT",
      score: rating.score,
      comment: rating.comment,
      tags: rating.tags,
      createdAt: rating.createdAt.toISOString(),
    },
  };
}

// ── Get Rating Summary for a Trip ────────────────────────────

export async function getTripRatingSummary(
  tripId: string
): Promise<RatingSummaryForTrip | null> {
  const session = await getServerAuth();
  if (!session?.sub) return null;
  const userId = session.sub;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { rider: true },
  });
  if (!trip) return null;

  const isClient = trip.clientId === userId;
  const isRider = trip.rider?.id === userId;
  if (!isClient && !isRider) return null;

  const [c2r, r2c] = await Promise.all([
    prisma.rating.findUnique({
      where: { tripId_direction: { tripId, direction: "CLIENT_TO_RIDER" } },
    }),
    prisma.rating.findUnique({
      where: { tripId_direction: { tripId, direction: "RIDER_TO_CLIENT" } },
    }),
  ]);

  const toRatingResponse = (r: typeof c2r) =>
    r
      ? ({
          id: r.id,
          tripId: r.tripId,
          direction: r.direction as "CLIENT_TO_RIDER" | "RIDER_TO_CLIENT",
          score: r.score,
          comment: r.comment,
          tags: r.tags,
          createdAt: r.createdAt.toISOString(),
        } satisfies RatingResponse)
      : null;

  // A dispute can be raised within 7 days of completion
  const disputeWindow = new Date(
    (trip.tripEndedAt ?? trip.updatedAt).getTime() + 7 * 24 * 60 * 60 * 1000
  );
  const canDispute = trip.status === "COMPLETED" && new Date() < disputeWindow;

  return {
    hasRatedAsClient: isClient ? !!c2r : undefined,
    hasRatedAsRider: isRider ? !!r2c : undefined,
    clientToRiderRating: isClient ? toRatingResponse(c2r) : undefined,
    riderToClientRating: isRider ? toRatingResponse(r2c) : undefined,
    canDispute,
  };
}

// ── Submit Dispute ────────────────────────────────────────────

export async function submitDispute(
  payload: SubmitDisputePayload
): Promise<{ success: true; data: DisputeResponse } | { success: false; error: string }> {
  const session = await getServerAuth();
  if (!session?.sub) return { success: false, error: "Unauthenticated" };
  const userId = session.sub;

  const { tripId, ratingId, reason, description } = payload;

  if (!description.trim()) {
    return { success: false, error: "Description is required" };
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { rider: true },
  });
  if (!trip) return { success: false, error: "Trip not found" };

  const isParticipant =
    trip.clientId === userId ||
    trip.rider?.id === userId;
  if (!isParticipant) {
    return { success: false, error: "You were not part of this trip" };
  }

  // One open dispute per user per trip
  const existingOpen = await prisma.dispute.findFirst({
    where: { tripId, raisedById: userId, status: "OPEN" },
  });
  if (existingOpen) {
    return {
      success: false,
      error: "You already have an open dispute for this trip",
    };
  }

  const dispute = await prisma.dispute.create({
    data: {
      tripId,
      ratingId: ratingId ?? null,
      raisedById: userId,
      reason,
      description: description.trim(),
      status: "OPEN",
    },
  });

  return {
    success: true,
    data: {
      id: dispute.id,
      tripId: dispute.tripId,
      reason: dispute.reason as typeof reason,
      status: dispute.status as "OPEN",
      createdAt: dispute.createdAt.toISOString(),
    },
  };
}
