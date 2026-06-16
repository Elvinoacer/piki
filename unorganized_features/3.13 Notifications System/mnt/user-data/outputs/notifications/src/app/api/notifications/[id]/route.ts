import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/notifications/[id]
 *
 * Fetches a single notification and marks it read. Used when a push
 * notification deep-links into the app (the app opens, resolves the
 * notificationId from the FCM data payload, and renders the associated
 * trip/payout/promo screen). The read-on-fetch behaviour syncs the bell
 * badge without a separate PATCH round-trip.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      userId: true,
      event: true,
      title: true,
      body: true,
      data: true,
      read: true,
      readAt: true,
      createdAt: true,
      tripId: true,
      deliveries: {
        select: { channel: true, status: true, providerRef: true, sentAt: true },
      },
    },
  });

  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (notification.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mark read inline if not already
  if (!notification.read) {
    await prisma.notification.update({
      where: { id: params.id },
      data: { read: true, readAt: new Date() },
    });
  }

  return NextResponse.json({ ...notification, read: true });
}

/**
 * DELETE /api/notifications/[id]
 *
 * Soft-deletes (hard delete for now) a notification from the user's inbox.
 * Only the owning user can delete their own notifications.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notification = await prisma.notification.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (notification.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.notification.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
