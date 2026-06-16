import "server-only";
import { NotificationChannel, NotificationEvent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_EVENT_REGISTRY } from "./events";
import { renderTemplate, SupportedLocale } from "./templates";
import { resolveChannelsForUser, resolveChannelsForUsers } from "./preferences";
import { fcmPushProvider } from "./providers/fcm";
import { africasTalkingSmsProvider } from "./providers/africastalking";
import { resendEmailProvider } from "./providers/email";
import type { SendResult } from "./providers/types";
import { emitInAppNotification } from "./realtime";

export interface TriggerNotificationInput {
  userId: string;
  event: NotificationEvent;
  /** Template variables — must satisfy all `{{placeholders}}` for this event's template. */
  vars: Record<string, string | number>;
  /** Optional linkage to a trip for the in-app inbox / deep-linking. */
  tripId?: string;
  /** Arbitrary extra data attached to the Notification row (deep links, ids, etc). */
  data?: Record<string, unknown>;
  /** Override locale — defaults to the user's stored preferredLocale, then "en". */
  locale?: SupportedLocale;
}

/**
 * Main entry point. Call this from server actions / route handlers / queue
 * workers whenever a notification-worthy event happens.
 *
 * Flow:
 *  1. Resolve which channels are enabled for this user+event (preferences.ts)
 *  2. Create the Notification row + one NotificationDelivery row per channel
 *     (including SKIPPED rows for opted-out channels, for audit purposes)
 *  3. Render templates per channel/locale
 *  4. Dispatch IN_APP immediately (in-process + realtime emit)
 *  5. Enqueue PUSH/SMS/EMAIL onto BullMQ for async, retryable delivery
 *
 * This function itself does NOT call external providers for push/SMS/email —
 * that happens in the queue worker (see src/lib/queue/workers/notifications.ts)
 * so a slow SMS provider never blocks the request that triggered it.
 */
export async function triggerNotification(
  input: TriggerNotificationInput,
): Promise<{ notificationId: string }> {
  const { userId, event, vars, tripId, data, locale } = input;

  const config = NOTIFICATION_EVENT_REGISTRY[event];
  const resolvedLocale = locale ?? (await getUserLocale(userId));

  const { enabled, skipped } = await resolveChannelsForUser(userId, event);

  // Render IN_APP copy now — it's used for both the Notification.title/body
  // (the inbox row) and, if enabled, the realtime push.
  const inAppRendered = renderTemplate(
    config.templateKey,
    "IN_APP",
    resolvedLocale,
    vars,
  );

  const notification = await prisma.notification.create({
    data: {
      userId,
      event,
      title: inAppRendered.title ?? "",
      body: inAppRendered.body,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined,
      tripId,
      deliveries: {
        create: [
          ...enabled.map((channel) => ({
            channel,
            status: "PENDING" as const,
          })),
          ...skipped.map((channel) => ({
            channel,
            status: "SKIPPED" as const,
          })),
        ],
      },
    },
    select: { id: true, deliveries: { select: { id: true, channel: true } } },
  });

  // --- IN_APP: handled synchronously (cheap — just emit over the realtime
  // channel the client is already subscribed to). ---
  if (enabled.includes("IN_APP")) {
    const delivery = notification.deliveries.find((d) => d.channel === "IN_APP");
    if (delivery) {
      await emitInAppNotification(userId, {
        id: notification.id,
        title: inAppRendered.title ?? "",
        body: inAppRendered.body,
        event,
        data,
        createdAt: new Date().toISOString(),
      });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "DELIVERED", sentAt: new Date(), deliveredAt: new Date() },
      });
    }
  }

  // --- PUSH / SMS / EMAIL: enqueue for async dispatch (rendered per-channel
  // inside the worker so we only do the work for channels that are enabled). ---
  const asyncChannels = enabled.filter((c) => c !== "IN_APP");
  if (asyncChannels.length > 0) {
    const { notificationQueue } = await import("@/lib/queue/queues");
    await notificationQueue.add(
      "dispatch-channels",
      {
        notificationId: notification.id,
        userId,
        event,
        channels: asyncChannels,
        vars,
        locale: resolvedLocale,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    );
  }

  return { notificationId: notification.id };
}

/**
 * Bulk fan-out variant for BROADCAST-style events (e.g. "Roadblock on Thika
 * Rd" to every online rider in a zone). Skips per-user synchronous work and
 * always queues — broadcasts can be large and must never block the admin
 * request that triggered them.
 */
export async function triggerBulkNotification(input: {
  userIds: string[];
  event: NotificationEvent;
  vars: Record<string, string | number>;
  data?: Record<string, unknown>;
  locale?: SupportedLocale;
}): Promise<{ count: number }> {
  const { userIds, event, vars, data, locale } = input;
  if (userIds.length === 0) return { count: 0 };

  const config = NOTIFICATION_EVENT_REGISTRY[event];
  const channelsByUser = await resolveChannelsForUsers(userIds, event);

  // Group users by their resolved locale to minimize template renders.
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, preferredLocale: true },
  });
  const localeByUser = new Map(
    users.map((u) => [u.id, (locale ?? u.preferredLocale ?? "en") as SupportedLocale]),
  );

  // Create Notification + deliveries in batches to avoid one giant transaction.
  const BATCH_SIZE = 200;
  let count = 0;

  for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
    const batch = userIds.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((userId) => {
        const resolvedLocale = localeByUser.get(userId) ?? "en";
        const { enabled, skipped } = channelsByUser.get(userId)!;
        const rendered = renderTemplate(config.templateKey, "IN_APP", resolvedLocale, vars);

        return prisma.notification.create({
          data: {
            userId,
            event,
            title: rendered.title ?? "",
            body: rendered.body,
            data: data ? JSON.parse(JSON.stringify(data)) : undefined,
            deliveries: {
              create: [
                ...enabled.map((channel) => ({ channel, status: "PENDING" as const })),
                ...skipped.map((channel) => ({ channel, status: "SKIPPED" as const })),
              ],
            },
          },
        });
      }),
    );

    count += batch.length;
  }

  // Enqueue one bulk job rather than N jobs — the worker fans out internally.
  const { notificationQueue } = await import("@/lib/queue/queues");
  await notificationQueue.add(
    "dispatch-bulk",
    { userIds, event, vars, locale, data },
    { attempts: 2, removeOnComplete: 50, removeOnFail: 200 },
  );

  return { count };
}

async function getUserLocale(userId: string): Promise<SupportedLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredLocale: true },
  });
  return (user?.preferredLocale as SupportedLocale) ?? "en";
}

/**
 * Sends a single channel for a single notification. Used by the BullMQ
 * worker. Exported separately so it's directly unit-testable without going
 * through the queue.
 */
export async function sendChannel(
  notificationId: string,
  userId: string,
  event: NotificationEvent,
  channel: NotificationChannel,
  vars: Record<string, string | number>,
  locale: SupportedLocale,
): Promise<void> {
  const config = NOTIFICATION_EVENT_REGISTRY[event];
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { notificationId_channel: { notificationId, channel } },
  });

  if (!delivery) {
    console.error(`No delivery row for notification=${notificationId} channel=${channel}`);
    return;
  }
  if (delivery.status === "DELIVERED" || delivery.status === "SENT") {
    return; // idempotency guard — already sent
  }

  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: { status: "QUEUED", queuedAt: new Date(), attempts: { increment: 1 } },
  });

  const rendered = renderTemplate(config.templateKey, channel, locale, vars);
  let result: SendResult;

  switch (channel) {
    case "PUSH": {
      const tokens = await prisma.pushToken.findMany({
        where: { userId },
        select: { token: true },
      });
      result = await fcmPushProvider.send({
        tokens: tokens.map((t) => t.token),
        title: rendered.title ?? "Pikii",
        body: rendered.body,
        data: { notificationId, event, ...stringifyData(vars) },
      });
      break;
    }
    case "SMS": {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
      if (!user?.phone) {
        result = { success: false, error: "User has no phone number", permanent: true };
        break;
      }
      result = await africasTalkingSmsProvider.send({ to: user.phone, message: rendered.body });
      break;
    }
    case "EMAIL": {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user?.email) {
        result = { success: false, error: "User has no email on file", permanent: true };
        break;
      }
      result = await resendEmailProvider.send({
        to: user.email,
        subject: rendered.emailSubject ?? rendered.title ?? "Pikii notification",
        body: rendered.body,
      });
      break;
    }
    default:
      result = { success: false, error: `Unsupported channel ${channel}`, permanent: true };
  }

  if (result.success) {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerRef: result.providerRef,
        errorMessage: null,
      },
    });
  } else {
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: result.error?.slice(0, 1000),
      },
    });

    // Permanent failures shouldn't be retried by BullMQ — throwing here
    // (vs. returning) is what triggers a retry, so for permanent failures
    // we swallow the error after marking FAILED.
    if (!result.permanent) {
      throw new Error(`${channel} delivery failed: ${result.error}`);
    }
  }
}

function stringifyData(vars: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) out[k] = String(v);
  return out;
}
