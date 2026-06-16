// src/app/api/notifications/route.ts
// GET   /api/notifications        — paginated in-app notification list
// PATCH /api/notifications        — mark notification(s) as read

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET — inbox ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      channel: "IN_APP",
      ...(unreadOnly ? { readAt: null } : {}),
      ...(cursor ? { createdAt: { lt: await getNotificationTimestamp(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const page = notifications.slice(0, limit);

  const unreadCount = await prisma.notification.count({
    where: {
      userId: session.user.id,
      channel: "IN_APP",
      readAt: null,
    },
  });

  return NextResponse.json({
    notifications: page.map((n) => ({
      id: n.id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      body: n.body,
      data: n.data,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
    cursor: hasMore ? page[page.length - 1].id : null,
  });
}

// ── PATCH — mark as read ──────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = (await req.json()) as { ids?: string[]; markAllRead?: boolean };
  const userId = session.user.id;
  const now = new Date();

  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { userId, channel: "IN_APP", readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ updated: true });
  }

  if (body.ids?.length) {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId, readAt: null },
      data: { readAt: now },
    });
    return NextResponse.json({ updated: true });
  }

  return NextResponse.json({ error: "Provide ids or markAllRead" }, { status: 400 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getNotificationTimestamp(id: string): Promise<Date> {
  const n = await prisma.notification.findUnique({
    where: { id },
    select: { createdAt: true },
  });
  return n?.createdAt ?? new Date();
}
