// src/app/api/chat/[tripId]/route.ts
// GET  /api/chat/:tripId  — fetch room info + unread count
// DELETE /api/chat/:tripId  — close chat (called internally when trip completes)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPusherServer, chatChannel, PUSHER_EVENTS } from "@/lib/pusher";

// ── GET — room info ───────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { tripId } = params;
  const userId = session.user.id;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { clientId: true, riderId: true },
  });

  if (!trip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (trip.clientId !== userId && trip.riderId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const room = await prisma.chatRoom.findUnique({
    where: { tripId },
    include: {
      _count: {
        select: {
          messages: { where: { senderId: { not: userId }, readAt: null, deletedAt: null } },
        },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ room: null, unreadCount: 0 });
  }

  return NextResponse.json({
    room: {
      id: room.id,
      tripId: room.tripId,
      isActive: room.isActive,
      createdAt: room.createdAt.toISOString(),
    },
    unreadCount: room._count.messages,
  });
}

// ── DELETE — close the chat room (admin / internal use) ───────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tripId: string } }
) {
  // Only called server-to-server (e.g., from trip completion webhook)
  // Use a shared internal secret for auth
  const authHeader = _req.headers.get("x-internal-secret");
  if (authHeader !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { tripId } = params;

  await prisma.chatRoom.update({
    where: { tripId },
    data: { isActive: false },
  });

  // Tell connected clients to lock the chat UI
  await getPusherServer().trigger(chatChannel(tripId), PUSHER_EVENTS.CHAT_CLOSED, {
    tripId,
  });

  return NextResponse.json({ success: true });
}
