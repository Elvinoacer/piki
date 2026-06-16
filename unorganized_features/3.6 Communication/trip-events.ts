// src/lib/trip-events.ts
// ─────────────────────────────────────────────────────────────────────────────
// Call these helpers from wherever trip status changes happen:
//   - Your trip API route (PATCH /api/trips/:id/status)
//   - BullMQ workers
//   - Payment webhook handlers
//   - Driver location proximity jobs
//
// Each function handles:
//   1. Sending the correct notification(s) to the correct users
//   2. Injecting automated SYSTEM chat messages into the trip chat
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notification-dispatcher";
import { getPusherServer, chatChannel, PUSHER_EVENTS } from "@/lib/pusher";
import type { StatusMessageContext } from "@/types/communication";

// ── Internal: inject an automated system message into chat ────────────────────

async function injectSystemMessage(tripId: string, body: string): Promise<void> {
  const room = await prisma.chatRoom.findUnique({ where: { tripId } });
  if (!room || !room.isActive) return;

  const message = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      // System messages use the app's bot user ID — create a SYSTEM user in seed
      senderId: process.env.SYSTEM_USER_ID!,
      body,
      type: "SYSTEM",
    },
  });

  await getPusherServer().trigger(chatChannel(tripId), PUSHER_EVENTS.NEW_MESSAGE, {
    message: {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderName: "Pikii",
      body: message.body,
      type: "SYSTEM",
      readAt: null,
      createdAt: message.createdAt.toISOString(),
      deletedAt: null,
    },
  });
}

// ── Public event helpers ──────────────────────────────────────────────────────

interface TripParties {
  clientId: string;
  riderId: string;
  riderName?: string;
  clientName?: string;
}

/** Called when a rider accepts a trip request */
export async function onTripAccepted(
  tripId: string,
  { clientId, riderId, riderName }: TripParties
) {
  const ctx: StatusMessageContext = { riderName, tripId };

  await Promise.allSettled([
    // Notify the client their rider is coming
    dispatchNotification({
      userId: clientId,
      type: "TRIP_ACCEPTED",
      channels: ["PUSH", "SMS", "IN_APP"],
      data: { tripId },
      ctx,
    }),
    // Open the chat room so both parties can message
    prisma.chatRoom.upsert({
      where: { tripId },
      update: { isActive: true },
      create: { tripId, isActive: true },
    }),
  ]);

  // System message in chat
  await injectSystemMessage(
    tripId,
    `${riderName ?? "Your rider"} has accepted the request. You can now chat securely — phone numbers are hidden.`
  );
}

/** Called when a rider reports they are arriving (within ~3 mins / configurable radius) */
export async function onRiderArriving(
  tripId: string,
  { clientId, riderName, eta }: TripParties & { eta: number }
) {
  const ctx: StatusMessageContext = { riderName, eta, tripId };

  await Promise.allSettled([
    dispatchNotification({
      userId: clientId,
      type: "RIDER_ARRIVING",
      channels: ["PUSH", "SMS", "IN_APP"],
      data: { tripId },
      ctx,
    }),
    injectSystemMessage(
      tripId,
      `${riderName ?? "Your rider"} is ${eta} minute${eta === 1 ? "" : "s"} away. Get ready!`
    ),
  ]);
}

/** Called when a rider marks themselves as arrived at pickup */
export async function onRiderArrived(
  tripId: string,
  { clientId, riderName }: TripParties
) {
  const ctx: StatusMessageContext = { riderName, tripId };

  await Promise.allSettled([
    dispatchNotification({
      userId: clientId,
      type: "RIDER_ARRIVED",
      channels: ["PUSH", "SMS", "IN_APP"],
      data: { tripId },
      ctx,
    }),
    injectSystemMessage(
      tripId,
      `${riderName ?? "Your rider"} has arrived at your pickup location.`
    ),
  ]);
}

/** Called when the trip starts (client boards) */
export async function onTripStarted(
  tripId: string,
  { clientId, riderId }: TripParties
) {
  await Promise.allSettled([
    dispatchNotification({
      userId: clientId,
      type: "TRIP_STARTED",
      channels: ["PUSH", "IN_APP"],
      data: { tripId },
    }),
    injectSystemMessage(tripId, "Your trip has started. Have a safe journey!"),
  ]);
}

/** Called when the trip is completed */
export async function onTripCompleted(
  tripId: string,
  { clientId, riderId, riderName }: TripParties
) {
  const ctx: StatusMessageContext = { riderName, tripId };

  await Promise.allSettled([
    // Notify client
    dispatchNotification({
      userId: clientId,
      type: "TRIP_COMPLETED",
      channels: ["PUSH", "SMS", "IN_APP"],
      data: { tripId },
      ctx,
    }),
    // Notify rider (payment confirmation comes separately)
    dispatchNotification({
      userId: riderId,
      type: "TRIP_COMPLETED",
      channels: ["PUSH", "IN_APP"],
      data: { tripId },
      ctx: {},
    }),
    // Close the chat room
    prisma.chatRoom.updateMany({
      where: { tripId },
      data: { isActive: false },
    }),
    // System message before chat locks
    injectSystemMessage(
      tripId,
      "You've arrived at your destination. This chat will now close. Please rate your experience."
    ),
    // Tell Pusher to lock the UI
    getPusherServer().trigger(chatChannel(tripId), PUSHER_EVENTS.CHAT_CLOSED, { tripId }),
  ]);
}

/** Called when a trip is cancelled (by either party or system) */
export async function onTripCancelled(
  tripId: string,
  { clientId, riderId, cancelledBy }: TripParties & { cancelledBy: "CLIENT" | "RIDER" | "SYSTEM" }
) {
  const notifyClientId = cancelledBy !== "CLIENT" ? clientId : null;
  const notifyRiderId = cancelledBy !== "RIDER" ? riderId : null;

  const jobs = [
    prisma.chatRoom.updateMany({ where: { tripId }, data: { isActive: false } }),
    getPusherServer().trigger(chatChannel(tripId), PUSHER_EVENTS.CHAT_CLOSED, { tripId }),
  ];

  if (notifyClientId) {
    jobs.push(
      dispatchNotification({
        userId: notifyClientId,
        type: "TRIP_CANCELLED",
        channels: ["PUSH", "SMS", "IN_APP"],
        data: { tripId },
      }) as unknown as typeof jobs[0]
    );
  }

  if (notifyRiderId) {
    jobs.push(
      dispatchNotification({
        userId: notifyRiderId,
        type: "TRIP_CANCELLED",
        channels: ["PUSH", "IN_APP"],
        data: { tripId },
      }) as unknown as typeof jobs[0]
    );
  }

  await Promise.allSettled(jobs);
}

/** Called when M-Pesa/payment confirms successful payment */
export async function onPaymentReceived(userId: string, tripId: string) {
  await dispatchNotification({
    userId,
    type: "PAYMENT_RECEIVED",
    channels: ["PUSH", "SMS", "IN_APP"],
    data: { tripId },
  });
}

/** Called when a rider withdrawal is processed */
export async function onPayoutProcessed(riderId: string, amount: number) {
  await dispatchNotification({
    userId: riderId,
    type: "PAYOUT_PROCESSED",
    channels: ["PUSH", "SMS", "IN_APP"],
    data: { amount: String(amount) },
  });
}
