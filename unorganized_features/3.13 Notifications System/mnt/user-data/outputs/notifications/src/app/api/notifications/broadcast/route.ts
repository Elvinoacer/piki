import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { triggerBulkNotification } from "@/lib/notifications/dispatcher";

const broadcastSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  /** "ALL" or a specific Zone id (PRD §3.2 geofencing / county-based rollout). */
  zoneId: z.string().or(z.literal("ALL")),
  /** Which roles to target — defaults to both. */
  audience: z.array(z.enum(["CLIENT", "RIDER"])).default(["CLIENT", "RIDER"]),
});

/**
 * POST /api/notifications/broadcast
 *
 * Admin-only. Sends a BROADCAST notification (PRD §3.12, e.g. "Roadblock on
 * Thika Rd — expect delays") to all users in a zone, or platform-wide.
 *
 * Authorization: requires session.user.role === "ADMIN". Returns 403
 * otherwise — broadcasts are loud and easy to abuse, so this is intentionally
 * strict (no SACCO_ADMIN access here; SACCO-scoped messaging would be a
 * separate, fleet-only event type if needed later).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
  }

  const parsed = broadcastSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, body, zoneId, audience } = parsed.data;

  const userIds = await resolveTargetUserIds(zoneId, audience);

  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "No users matched the given zone/audience — broadcast not sent" },
      { status: 400 },
    );
  }

  // Safety valve: very large broadcasts should go through a slower,
  // explicitly-confirmed path (avoid accidental platform-wide spam from a
  // typo'd zoneId). Adjust threshold as the user base grows.
  const LARGE_BROADCAST_THRESHOLD = 50_000;
  if (userIds.length > LARGE_BROADCAST_THRESHOLD) {
    return NextResponse.json(
      {
        error: `This broadcast would reach ${userIds.length} users, exceeding the ${LARGE_BROADCAST_THRESHOLD} safety threshold. Use the confirmed large-broadcast flow instead.`,
      },
      { status: 400 },
    );
  }

  const { count } = await triggerBulkNotification({
    userIds,
    event: "BROADCAST",
    vars: { broadcastTitle: title, broadcastBody: body },
    data: { zoneId },
  });

  await prisma.auditLog.create({
    data: {
      adminUserId: session.user.id,
      action: "BROADCAST_SENT",
      metadata: { title, body, zoneId, audience, recipientCount: count },
    },
  });

  return NextResponse.json({ success: true, recipientCount: count });
}

/**
 * Resolves which users should receive a broadcast. "ALL" zone targets every
 * active user matching `audience`. A specific zoneId restricts to users
 * whose ClientProfile/RiderProfile places them in that zone — adjust the
 * `where` clauses below once your Zone <-> User relation is finalized
 * (e.g. via RiderProfile.currentZoneId or a geo lookup against Zone bounds).
 */
async function resolveTargetUserIds(
  zoneId: string,
  audience: Array<"CLIENT" | "RIDER">,
): Promise<string[]> {
  const roleFilter = { role: { in: audience } } as const;

  if (zoneId === "ALL") {
    const users = await prisma.user.findMany({
      where: { ...roleFilter, status: "ACTIVE" },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  // Zone-scoped: riders currently assigned to this zone, and/or clients
  // whose last trip pickup fell within it. Adjust to your actual Zone model.
  const users = await prisma.user.findMany({
    where: {
      ...roleFilter,
      status: "ACTIVE",
      OR: [
        { riderProfile: { currentZoneId: zoneId } },
        { clientProfile: { lastZoneId: zoneId } },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
