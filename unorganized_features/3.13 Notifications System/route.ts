import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const PAGE_SIZE = 20;

/**
 * GET /api/notifications?cursor=<id>&unreadOnly=true
 *
 * Cursor-paginated list of in-app notifications for the inbox / bell icon.
 * `unreadOnly=true` powers the badge count + filtered view.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        event: true,
        title: true,
        body: true,
        data: true,
        read: true,
        createdAt: true,
        tripId: true,
      },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, read: false },
    }),
  ]);

  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;

  return NextResponse.json({
    items: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
    unreadCount,
  });
}

/**
 * PATCH /api/notifications
 * Body: { ids: string[] } | { all: true }
 *
 * Marks notifications as read. `{ all: true }` marks the entire inbox read
 * (used by "mark all as read").
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ids?: string[]; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date();

  if (body.all === true) {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true, readAt: now },
    });
    return NextResponse.json({ updated: result.count });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: session.user.id },
      data: { read: true, readAt: now },
    });
    return NextResponse.json({ updated: result.count });
  }

  return NextResponse.json({ error: "Provide `ids` array or `all: true`" }, { status: 400 });
}
