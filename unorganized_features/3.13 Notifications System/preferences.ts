import "server-only";
import { NotificationChannel, NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultChannels,
  isChannelLocked,
  ALL_CHANNELS,
} from "./events";

export interface ResolvedChannels {
  /** Channels the notification should actually be sent through. */
  enabled: NotificationChannel[];
  /** Channels skipped due to user opt-out (for NotificationDelivery=SKIPPED rows). */
  skipped: NotificationChannel[];
}

/**
 * Resolves the final channel list for (userId, event), applying:
 *   1. Default channels for the event (events.ts)
 *   2. User overrides from NotificationPreference
 *   3. Locked channels (always included, regardless of user preference)
 *
 * Result is the *intersection* of "would be sent" and "channel is otherwise
 * available" — availability (e.g. does the user have a push token, do they
 * have an email on file) is checked separately by the dispatcher, since that
 * affects routing/fallback, not preference.
 */
export async function resolveChannelsForUser(
  userId: string,
  event: NotificationEvent,
): Promise<ResolvedChannels> {
  const defaults = getDefaultChannels(event);

  const overrides = await prisma.notificationPreference.findMany({
    where: { userId, event },
    select: { channel: true, enabled: true },
  });

  const overrideMap = new Map(
    overrides.map((o) => [o.channel, o.enabled]),
  );

  const enabled: NotificationChannel[] = [];
  const skipped: NotificationChannel[] = [];

  for (const channel of ALL_CHANNELS) {
    const locked = isChannelLocked(event, channel);
    const isDefault = defaults.includes(channel);
    const override = overrideMap.get(channel);

    // Locked channels are always on, regardless of default or override.
    if (locked) {
      enabled.push(channel);
      continue;
    }

    // Explicit user override wins over default.
    if (override !== undefined) {
      if (override) {
        enabled.push(channel);
      } else if (isDefault) {
        // Only record as "skipped" (for audit/UX) if it would've been sent
        // by default — irrelevant channels don't need a SKIPPED row.
        skipped.push(channel);
      }
      continue;
    }

    // No override: fall back to event default.
    if (isDefault) {
      enabled.push(channel);
    }
  }

  return { enabled, skipped };
}

/**
 * Bulk variant for fan-out notifications (e.g. BROADCAST to all riders in a
 * zone) — avoids N sequential DB roundtrips.
 */
export async function resolveChannelsForUsers(
  userIds: string[],
  event: NotificationEvent,
): Promise<Map<string, ResolvedChannels>> {
  const defaults = getDefaultChannels(event);

  const overrides = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, event },
    select: { userId: true, channel: true, enabled: true },
  });

  const byUser = new Map<string, Map<NotificationChannel, boolean>>();
  for (const o of overrides) {
    if (!byUser.has(o.userId)) byUser.set(o.userId, new Map());
    byUser.get(o.userId)!.set(o.channel, o.enabled);
  }

  const result = new Map<string, ResolvedChannels>();

  for (const userId of userIds) {
    const overrideMap = byUser.get(userId) ?? new Map();
    const enabled: NotificationChannel[] = [];
    const skipped: NotificationChannel[] = [];

    for (const channel of ALL_CHANNELS) {
      const locked = isChannelLocked(event, channel);
      const isDefault = defaults.includes(channel);
      const override = overrideMap.get(channel);

      if (locked) {
        enabled.push(channel);
        continue;
      }
      if (override !== undefined) {
        if (override) enabled.push(channel);
        else if (isDefault) skipped.push(channel);
        continue;
      }
      if (isDefault) enabled.push(channel);
    }

    result.set(userId, { enabled, skipped });
  }

  return result;
}
