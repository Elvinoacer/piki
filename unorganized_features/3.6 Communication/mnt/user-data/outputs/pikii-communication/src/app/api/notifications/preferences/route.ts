// src/app/api/notifications/preferences/route.ts
// GET  /api/notifications/preferences  — fetch current user's prefs
// PUT  /api/notifications/preferences  — update prefs (channels, type overrides, FCM token)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { NotificationPreferences } from "@/types/communication";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  // Return sensible defaults if no record exists yet
  const defaults: NotificationPreferences = {
    pushEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    typeOverrides: {},
    fcmToken: undefined,
  };

  if (!prefs) return NextResponse.json(defaults);

  return NextResponse.json({
    pushEnabled: prefs.pushEnabled,
    smsEnabled: prefs.smsEnabled,
    inAppEnabled: prefs.inAppEnabled,
    typeOverrides: prefs.typeOverrides ?? {},
    fcmToken: prefs.fcmToken ?? undefined,
  } satisfies NotificationPreferences);
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<NotificationPreferences>;
  const userId = session.user.id;

  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      ...(body.pushEnabled !== undefined && { pushEnabled: body.pushEnabled }),
      ...(body.smsEnabled !== undefined && { smsEnabled: body.smsEnabled }),
      ...(body.inAppEnabled !== undefined && { inAppEnabled: body.inAppEnabled }),
      ...(body.typeOverrides !== undefined && { typeOverrides: body.typeOverrides }),
      ...(body.fcmToken !== undefined && {
        fcmToken: body.fcmToken,
        fcmTokenUpdatedAt: new Date(),
      }),
    },
    create: {
      userId,
      pushEnabled: body.pushEnabled ?? true,
      smsEnabled: body.smsEnabled ?? true,
      inAppEnabled: body.inAppEnabled ?? true,
      typeOverrides: body.typeOverrides ?? {},
      fcmToken: body.fcmToken ?? null,
      fcmTokenUpdatedAt: body.fcmToken ? new Date() : null,
    },
  });

  return NextResponse.json({
    pushEnabled: updated.pushEnabled,
    smsEnabled: updated.smsEnabled,
    inAppEnabled: updated.inAppEnabled,
    typeOverrides: updated.typeOverrides ?? {},
    fcmToken: updated.fcmToken ?? undefined,
  });
}
