// src/app/api/chat/[tripId]/messages/route.ts
// GET  /api/chat/:tripId/messages  — paginated message history
// POST /api/chat/:tripId/messages  — send a new message

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // your existing NextAuth config
import { prisma } from "@/lib/prisma";
import { getPusherServer, chatChannel, PUSHER_EVENTS } from "@/lib/pusher";
import { dispatchNotification } from "@/lib/notification-dispatcher";
import type { SendMessagePayload } from "@/types/communication";

// ── GET — fetch messages ──────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { tripId } = params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // message id for pagination
  const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);

  // Verify user is a participant in this trip
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { clientId: true, riderId: true },
  });

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const userId = session.user.id;
  const isParticipant = trip.clientId === userId || trip.riderId === userId;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find or ensure chat room exists
  const room = await prisma.chatRoom.findUnique({
    where: { tripId },
  });

  if (!room) return NextResponse.json({ messages: [], cursor: null });

  // Fetch messages (newest first, then reverse for display)
  const messages = await prisma.chatMessage.findMany({
    where: {
      roomId: room.id,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: await getMessageTimestamp(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      sender: { select: { id: true, role: true } },
    },
  });

  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit);

  // Mark messages from the other party as read
  const unreadIds = page
    .filter((m) => m.senderId !== userId && !m.readAt)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await prisma.chatMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { readAt: new Date() },
    });
    // Notify the sender their messages were read (via Pusher)
    await getPusherServer().trigger(
      chatChannel(tripId),
      PUSHER_EVENTS.MESSAGE_READ,
      { readIds: unreadIds, readBy: userId }
    );
  }

  return NextResponse.json({
    messages: page.reverse().map((m) => formatMessage(m, trip)),
    cursor: hasMore ? page[page.length - 1].id : null,
  });
}

// ── POST — send a message ─────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { tripId } = params;
  const body = (await req.json()) as SendMessagePayload;

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  // Verify trip + participant
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { clientId: true, riderId: true, status: true },
  });

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const userId = session.user.id;
  if (trip.clientId !== userId && trip.riderId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Chat is only active while the trip is in an active state
  const CHAT_ACTIVE_STATUSES = ["ACCEPTED", "ARRIVING", "ARRIVED", "IN_PROGRESS"];
  if (!CHAT_ACTIVE_STATUSES.includes(trip.status)) {
    return NextResponse.json({ error: "Chat is closed for this trip" }, { status: 409 });
  }

  // Upsert chat room (created on first message)
  const room = await prisma.chatRoom.upsert({
    where: { tripId },
    update: {},
    create: { tripId },
  });

  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      roomId: room.id,
      senderId: userId,
      body: body.body.trim(),
      type: body.type ?? "TEXT",
    },
    include: {
      sender: { select: { id: true, role: true } },
    },
  });

  const formatted = formatMessage(message, trip);

  // Broadcast to trip channel via Pusher (real-time delivery)
  await getPusherServer().trigger(chatChannel(tripId), PUSHER_EVENTS.NEW_MESSAGE, {
    message: formatted,
  });

  // Send in-app + push notification to the other party
  const recipientId = userId === trip.clientId ? trip.riderId : trip.clientId;
  if (recipientId) {
    await dispatchNotification({
      userId: recipientId,
      type: "CHAT_MESSAGE",
      channels: ["PUSH", "IN_APP"], // no SMS for chat — data cost sensitivity
      data: { tripId, messageId: message.id },
    });
  }

  return NextResponse.json({ message: formatted }, { status: 201 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMessage(
  m: {
    id: string;
    roomId: string;
    senderId: string;
    body: string;
    type: string;
    readAt: Date | null;
    createdAt: Date;
    deletedAt: Date | null;
    sender: { id: string; role: string };
  },
  trip: { clientId: string | null; riderId: string | null }
) {
  // Mask names — client sees "Rider", rider sees "Client"
  const isRider = m.senderId === trip.riderId;
  return {
    id: m.id,
    roomId: m.roomId,
    senderId: m.senderId,
    senderName: isRider ? "Rider" : "Client",
    body: m.deletedAt ? "[message removed]" : m.body,
    type: m.type,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString() ?? null,
  };
}

async function getMessageTimestamp(messageId: string): Promise<Date> {
  const msg = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { createdAt: true },
  });
  return msg?.createdAt ?? new Date();
}
