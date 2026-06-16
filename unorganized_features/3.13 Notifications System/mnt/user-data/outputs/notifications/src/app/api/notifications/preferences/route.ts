import { NextRequest, NextResponse } from "next/server";
import { NotificationChannel, NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  ALL_CHANNELS,
  ALL_EVENTS,
  NOTIFICATION_EVENT_REGISTRY,
  getDefaultChannels,
  isChannelLocked,
} from "@/lib/notifications/events";

/**
 * GET /api/notifications/preferences
 *
 * Returns the full preference matrix for the current user: every event x
 * every channel, with `enabled` (effective value, default-or-override),
 * `locked` (cannot be changed), and `isDefault` (whether `enabled` reflects
 * the system default vs an explicit user override).
 *
 * Shape is designed to drive a settings UI directly (table of toggles).
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overrides = await prisma.notificationPreference.findMany({
    where: { userId: session.user.id },
    select: { event: true, channel: true, enabled: true },
  });

  const overrideMap = new Map(
    overrides.map((o) => [`${o.event}:${o.channel}`, o.enabled]),
  );

  const events = ALL_EVENTS.map((event) => {
    const config = NOTIFICATION_EVENT_REGISTRY[event];
    const defaults = getDefaultChannels(event);

    const channels = ALL_CHANNELS.map((channel) => {
      const locked = isChannelLocked(event, channel);
      const override = overrideMap.get(`${event}:${channel}`);
      const isDefault = defaults.includes(channel);
      const enabled = locked ? true : override ?? isDefault;

      return {
        channel,
        enabled,
        locked,
        isDefault: override === undefined,
      };
    });

    return {
      event,
      description: config.description,
      roles: config.roles,
      channels,
    };
  });

  return NextResponse.json({ events });
}

interface PreferenceUpdate {
  event: NotificationEvent;
  channel: NotificationChannel;
  enabled: boolean;
}

/**
 * PUT /api/notifications/preferences
 * Body: { updates: PreferenceUpdate[] }
 *
 * Upserts NotificationPreference rows. Locked channels are rejected with
 * a 400 (not silently ignored) so the client UI gets explicit feedback if
 * it somehow allowed toggling a locked switch.
 */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { updates?: PreferenceUpdate[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "`updates` must be a non-empty array" }, { status: 400 });
  }

  for (const update of updates) {
    if (!ALL_EVENTS.includes(update.event)) {
      return NextResponse.json({ error: `Invalid event: ${update.event}` }, { status: 400 });
    }
    if (!ALL_CHANNELS.includes(update.channel)) {
      return NextResponse.json({ error: `Invalid channel: ${update.channel}` }, { status: 400 });
    }
    if (isChannelLocked(update.event, update.channel) && update.enabled === false) {
      return NextResponse.json(
        {
          error: `Channel "${update.channel}" cannot be disabled for event "${update.event}" (locked for safety/compliance).`,
        },
        { status: 400 },
      );
    }
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_event_channel: {
            userId: session.user.id,
            event: u.event,
            channel: u.channel,
          },
        },
        create: {
          userId: session.user.id,
          event: u.event,
          channel: u.channel,
          enabled: u.enabled,
        },
        update: { enabled: u.enabled },
      }),
    ),
  );

  return NextResponse.json({ success: true, updated: updates.length });
}
