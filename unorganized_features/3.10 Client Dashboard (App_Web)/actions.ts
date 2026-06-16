"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  BookingRequest,
  FareEstimate,
  TripHistoryItem,
  SavedPlace,
  PromoResult,
  ReferralInfo,
  SupportTicket,
  CreateTicketPayload,
  WalletBalance,
  ActiveTrip,
  Rider,
} from "@/types/client-dashboard";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireClientSession() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");
  if (session.user.role !== "CLIENT") throw new Error("Forbidden");
  return session.user.id;
}

// ─── Fare Estimate ────────────────────────────────────────────────────────────

export async function getFareEstimate(
  request: Pick<BookingRequest, "pickup" | "destination" | "type" | "stops">
): Promise<FareEstimate> {
  await requireClientSession();

  // Resolve active zone pricing for origin
  const zone = await prisma.zone.findFirst({
    where: { isActive: true },
    // In production: use PostGIS ST_Contains query matching pickup coords
  });

  const baseRate = zone?.baseFare ?? 50; // KES
  const perKmRate = zone?.perKmRate ?? 20;
  const perMinRate = zone?.perMinRate ?? 2;

  // Stub: replace with Google Maps Directions API call
  const distanceKm = 5.4;
  const estimatedMinutes = 18;
  const surgeMultiplier = zone?.currentSurge ?? 1;

  const baseFare = baseRate;
  const distanceFare = distanceKm * perKmRate;
  const timeFare = estimatedMinutes * perMinRate;
  const totalBeforeDiscount =
    (baseFare + distanceFare + timeFare) * surgeMultiplier;

  return {
    baseFare,
    distanceFare,
    timeFare,
    surgeMultiplier,
    promoDiscount: 0,
    totalFare: totalBeforeDiscount,
    distanceKm,
    estimatedMinutes,
    currency: "KES",
  };
}

// ─── Promo Code ───────────────────────────────────────────────────────────────

export async function applyPromoCode(
  code: string,
  currentFare: number
): Promise<PromoResult> {
  const clientId = await requireClientSession();

  const promo = await prisma.promoCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      expiresAt: { gt: new Date() },
      OR: [{ maxUses: null }, { usedCount: { lt: prisma.promoCode.fields.maxUses } }],
    },
  });

  if (!promo) {
    return { valid: false, discount: 0, description: "Invalid or expired promo code.", code };
  }

  const alreadyUsed = await prisma.redemption.findFirst({
    where: { clientId, promoCodeId: promo.id },
  });

  if (alreadyUsed) {
    return { valid: false, discount: 0, description: "You have already used this code.", code };
  }

  const discount =
    promo.discountType === "PERCENT"
      ? (currentFare * promo.discountValue) / 100
      : promo.discountValue;

  return {
    valid: true,
    discount: Math.min(discount, currentFare),
    description: promo.description ?? `${promo.discountValue}${promo.discountType === "PERCENT" ? "%" : " KES"} off`,
    code: promo.code,
  };
}

// ─── Book Ride ────────────────────────────────────────────────────────────────

export async function bookRide(request: BookingRequest): Promise<{ tripId: string }> {
  const clientId = await requireClientSession();

  const fareEstimate = await getFareEstimate(request);

  let promoDiscount = 0;
  if (request.promoCode) {
    const promoResult = await applyPromoCode(request.promoCode, fareEstimate.totalFare);
    promoDiscount = promoResult.valid ? promoResult.discount : 0;
  }

  const trip = await prisma.trip.create({
    data: {
      clientId,
      type: request.type,
      status: "REQUESTED",
      pickupAddress: request.pickup.formattedAddress,
      pickupLat: request.pickup.latLng.lat,
      pickupLng: request.pickup.latLng.lng,
      destinationAddress: request.destination.formattedAddress,
      destinationLat: request.destination.latLng.lat,
      destinationLng: request.destination.latLng.lng,
      estimatedFare: fareEstimate.totalFare - promoDiscount,
      paymentMethod: request.paymentMethod,
      scheduledAt: request.scheduledAt ? new Date(request.scheduledAt) : null,
      stops: {
        create: (request.stops ?? []).map((stop, index) => ({
          address: stop.formattedAddress,
          lat: stop.latLng.lat,
          lng: stop.latLng.lng,
          order: index + 1,
        })),
      },
    },
  });

  // Trip will be picked up by the matching worker (BullMQ job)
  return { tripId: trip.id };
}

// ─── Cancel Trip ──────────────────────────────────────────────────────────────

export async function cancelTrip(tripId: string): Promise<void> {
  const clientId = await requireClientSession();

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, clientId },
    select: { status: true, acceptedAt: true },
  });

  if (!trip) throw new Error("Trip not found");
  if (!["REQUESTED", "ACCEPTED", "ARRIVING"].includes(trip.status)) {
    throw new Error("Trip cannot be cancelled at this stage");
  }

  // Cancellation fee logic: charged if rider is en route
  const isLate = trip.acceptedAt
    ? Date.now() - trip.acceptedAt.getTime() > 2 * 60 * 1000
    : false;

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationFee: isLate ? 20 : 0, // KES 20 late cancel fee
    },
  });
}

// ─── Trip History ─────────────────────────────────────────────────────────────

export async function getTripHistory(
  page = 1,
  pageSize = 20
): Promise<{ trips: TripHistoryItem[]; total: number }> {
  const clientId = await requireClientSession();

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where: { clientId, status: { in: ["COMPLETED", "CANCELLED"] } },
      include: {
        rider: {
          include: { riderProfile: { select: { photoUrl: true, plateNumber: true } } },
        },
        payment: { select: { receiptUrl: true } },
        ratings: { where: { raterRole: "CLIENT" }, select: { score: true } },
      },
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.trip.count({ where: { clientId, status: { in: ["COMPLETED", "CANCELLED"] } } }),
  ]);

  const mapped: TripHistoryItem[] = trips.map((t) => ({
    id: t.id,
    status: t.status as TripHistoryItem["status"],
    type: t.type as TripHistoryItem["type"],
    pickup: { formattedAddress: t.pickupAddress, latLng: { lat: t.pickupLat, lng: t.pickupLng } },
    destination: { formattedAddress: t.destinationAddress, latLng: { lat: t.destinationLat, lng: t.destinationLng } },
    rider: {
      id: t.rider?.id ?? "",
      name: t.rider?.name ?? "Rider",
      photoUrl: t.rider?.riderProfile?.photoUrl ?? "",
      rating: 4.8, // resolved separately in production
      plateNumber: t.rider?.riderProfile?.plateNumber ?? "",
    },
    actualFare: t.actualFare ?? t.estimatedFare ?? 0,
    paymentMethod: t.paymentMethod as TripHistoryItem["paymentMethod"],
    completedAt: t.completedAt?.toISOString() ?? "",
    clientRating: t.ratings[0]?.score ?? undefined,
    receiptUrl: t.payment?.receiptUrl ?? undefined,
    canRebook: t.status === "COMPLETED",
  }));

  return { trips: mapped, total };
}

// ─── Submit Rating ─────────────────────────────────────────────────────────────

export async function submitRating(
  tripId: string,
  score: number,
  tags: string[],
  comment?: string
): Promise<void> {
  const clientId = await requireClientSession();

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, clientId, status: "COMPLETED" },
    select: { riderId: true },
  });

  if (!trip) throw new Error("Trip not found or not eligible for rating");

  await prisma.rating.upsert({
    where: { tripId_raterRole: { tripId, raterRole: "CLIENT" } },
    create: {
      tripId,
      raterId: clientId,
      ratedId: trip.riderId!,
      raterRole: "CLIENT",
      score,
      tags,
      comment,
    },
    update: { score, tags, comment },
  });

  revalidatePath("/dashboard/history");
}

// ─── Saved Places ─────────────────────────────────────────────────────────────

export async function getSavedPlaces(): Promise<SavedPlace[]> {
  const clientId = await requireClientSession();

  const places = await prisma.savedPlace.findMany({
    where: { clientId },
    orderBy: [{ type: "asc" }, { usageCount: "desc" }],
  });

  return places.map((p) => ({
    id: p.id,
    type: p.type as SavedPlace["type"],
    label: p.label,
    address: {
      formattedAddress: p.address,
      latLng: { lat: p.lat, lng: p.lng },
      placeId: p.placeId ?? undefined,
    },
    usageCount: p.usageCount,
  }));
}

export async function upsertSavedPlace(
  data: Omit<SavedPlace, "id" | "usageCount"> & { id?: string }
): Promise<void> {
  const clientId = await requireClientSession();

  await prisma.savedPlace.upsert({
    where: { id: data.id ?? "" },
    create: {
      clientId,
      type: data.type,
      label: data.label,
      address: data.address.formattedAddress,
      lat: data.address.latLng.lat,
      lng: data.address.latLng.lng,
      placeId: data.address.placeId ?? null,
      usageCount: 0,
    },
    update: {
      label: data.label,
      address: data.address.formattedAddress,
      lat: data.address.latLng.lat,
      lng: data.address.latLng.lng,
      placeId: data.address.placeId ?? null,
    },
  });

  revalidatePath("/dashboard");
}

export async function deleteSavedPlace(id: string): Promise<void> {
  const clientId = await requireClientSession();
  await prisma.savedPlace.deleteMany({ where: { id, clientId } });
  revalidatePath("/dashboard");
}

// ─── Favorite Riders ──────────────────────────────────────────────────────────

export async function getFavoriteRiders(): Promise<Rider[]> {
  const clientId = await requireClientSession();

  const favs = await prisma.favoriteRider.findMany({
    where: { clientId },
    include: {
      rider: {
        include: {
          riderProfile: {
            select: { photoUrl: true, plateNumber: true, rating: true, totalTrips: true, badges: true },
          },
        },
      },
    },
  });

  return favs.map((f) => ({
    id: f.rider.id,
    name: f.rider.name ?? "Rider",
    photoUrl: f.rider.riderProfile?.photoUrl ?? "",
    plateNumber: f.rider.riderProfile?.plateNumber ?? "",
    rating: f.rider.riderProfile?.rating ?? 5,
    totalTrips: f.rider.riderProfile?.totalTrips ?? 0,
    badges: (f.rider.riderProfile?.badges ?? []) as Rider["badges"],
    isFavorite: true,
  }));
}

export async function toggleFavoriteRider(
  riderId: string,
  isFavorite: boolean
): Promise<void> {
  const clientId = await requireClientSession();

  if (isFavorite) {
    await prisma.favoriteRider.upsert({
      where: { clientId_riderId: { clientId, riderId } },
      create: { clientId, riderId },
      update: {},
    });
  } else {
    await prisma.favoriteRider.deleteMany({ where: { clientId, riderId } });
  }
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getWalletBalance(): Promise<WalletBalance> {
  const clientId = await requireClientSession();

  const wallet = await prisma.wallet.findUnique({
    where: { userId: clientId },
    select: { balance: true, lastTopUpAt: true },
  });

  return {
    balance: wallet?.balance ?? 0,
    currency: "KES",
    lastTopUpAt: wallet?.lastTopUpAt?.toISOString(),
  };
}

// ─── Referral ─────────────────────────────────────────────────────────────────

export async function getReferralInfo(): Promise<ReferralInfo> {
  const clientId = await requireClientSession();

  const profile = await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: { referralCode: true, referralCount: true, creditsEarned: true },
  });

  const code = profile?.referralCode ?? "";

  return {
    code,
    referralCount: profile?.referralCount ?? 0,
    creditsEarned: profile?.creditsEarned ?? 0,
    shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/join?ref=${code}`,
  };
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export async function getMyTickets(): Promise<SupportTicket[]> {
  const clientId = await requireClientSession();

  const tickets = await prisma.supportTicket.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      tripId: true,
    },
  });

  return tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status as SupportTicket["status"],
    createdAt: t.createdAt.toISOString(),
    lastReplyAt: t.updatedAt.toISOString(),
    tripId: t.tripId ?? undefined,
  }));
}

export async function createSupportTicket(
  payload: CreateTicketPayload
): Promise<{ ticketId: string }> {
  const clientId = await requireClientSession();

  const ticket = await prisma.supportTicket.create({
    data: {
      clientId,
      subject: payload.subject,
      description: payload.description,
      category: payload.category,
      status: "OPEN",
      tripId: payload.tripId ?? null,
    },
  });

  revalidatePath("/dashboard/support");
  return { ticketId: ticket.id };
}

// ─── Active Trip (server-side hydration) ──────────────────────────────────────

export async function getActiveTrip(): Promise<ActiveTrip | null> {
  const clientId = await requireClientSession();

  const trip = await prisma.trip.findFirst({
    where: {
      clientId,
      status: { in: ["REQUESTED", "ACCEPTED", "ARRIVING", "ARRIVED", "IN_PROGRESS"] },
    },
    include: {
      rider: {
        include: {
          riderProfile: {
            select: {
              photoUrl: true,
              plateNumber: true,
              rating: true,
              totalTrips: true,
              badges: true,
              currentLat: true,
              currentLng: true,
              currentHeading: true,
              locationUpdatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!trip || !trip.rider) return null;

  const rp = trip.rider.riderProfile!;

  return {
    id: trip.id,
    status: trip.status as ActiveTrip["status"],
    type: trip.type as ActiveTrip["type"],
    pickup: { formattedAddress: trip.pickupAddress, latLng: { lat: trip.pickupLat, lng: trip.pickupLng } },
    destination: { formattedAddress: trip.destinationAddress, latLng: { lat: trip.destinationLat, lng: trip.destinationLng } },
    rider: {
      id: trip.rider.id,
      name: trip.rider.name ?? "Rider",
      photoUrl: rp.photoUrl ?? "",
      plateNumber: rp.plateNumber ?? "",
      rating: rp.rating ?? 5,
      totalTrips: rp.totalTrips ?? 0,
      badges: (rp.badges ?? []) as Rider["badges"],
      isFavorite: false,
    },
    riderLocation: {
      latLng: { lat: rp.currentLat ?? 0, lng: rp.currentLng ?? 0 },
      heading: rp.currentHeading ?? 0,
      updatedAt: rp.locationUpdatedAt?.toISOString() ?? new Date().toISOString(),
    },
    fareEstimate: {
      baseFare: 50,
      distanceFare: 108,
      timeFare: 36,
      surgeMultiplier: 1,
      promoDiscount: 0,
      totalFare: trip.estimatedFare ?? 194,
      distanceKm: 5.4,
      estimatedMinutes: 18,
      currency: "KES",
    },
    paymentMethod: trip.paymentMethod as ActiveTrip["paymentMethod"],
    etaMinutes: 5, // resolved from WebSocket / recalculated
    shareLink: `${process.env.NEXT_PUBLIC_APP_URL}/trip/${trip.id}/track`,
  };
}
