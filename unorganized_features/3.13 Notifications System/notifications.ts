import "server-only";
import { Worker, Job } from "bullmq";
import { NotificationChannel, NotificationEvent } from "@prisma/client";
import { redisConnection } from "@/lib/queue/queues";
import { sendChannel, triggerNotification } from "@/lib/notifications/dispatcher";
import type { SupportedLocale } from "@/lib/notifications/templates";

interface DispatchChannelsJobData {
  notificationId: string;
  userId: string;
  event: NotificationEvent;
  channels: NotificationChannel[];
  vars: Record<string, string | number>;
  locale: SupportedLocale;
}

interface DispatchBulkJobData {
  userIds: string[];
  event: NotificationEvent;
  vars: Record<string, string | number>;
  locale?: SupportedLocale;
  data?: Record<string, unknown>;
}

/**
 * Worker for the "notifications" queue. Run this in a separate process from
 * the Next.js server (e.g. `node dist/workers/notifications.js` as a
 * standalone deploy target, or a Vercel cron/queue consumer depending on
 * hosting choice — see PRD §4.1 "Background Jobs").
 *
 * Concurrency: 10 — tuned for SMS/email provider rate limits. Adjust based
 * on Africa's Talking / Resend account limits.
 */
export const notificationWorker = new Worker(
  "notifications",
  async (job: Job) => {
    switch (job.name) {
      case "dispatch-channels":
        return handleDispatchChannels(job.data as DispatchChannelsJobData);
      case "dispatch-bulk":
        return handleDispatchBulk(job.data as DispatchBulkJobData);
      default:
        console.warn(`Unknown job name "${job.name}" in notifications queue`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

async function handleDispatchChannels(data: DispatchChannelsJobData): Promise<void> {
  const { notificationId, userId, event, channels, vars, locale } = data;

  // Send channels in parallel — each is independently retried by virtue of
  // the per-delivery status tracking in sendChannel(). If one channel throws
  // (transient failure), the whole job is retried by BullMQ, but sendChannel
  // is idempotent (skips already-SENT/DELIVERED channels) so retries don't
  // double-send successful channels.
  const results = await Promise.allSettled(
    channels.map((channel) => sendChannel(notificationId, userId, event, channel, vars, locale)),
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    // Re-throw so BullMQ applies the job-level retry/backoff. Already-sent
    // channels are skipped on retry thanks to the idempotency guard.
    throw new Error(
      `${failures.length}/${channels.length} channel(s) failed for notification ${notificationId}`,
    );
  }
}

async function handleDispatchBulk(data: DispatchBulkJobData): Promise<void> {
  const { userIds, event, vars, locale, data: extraData } = data;

  // Process in chunks to avoid overwhelming providers / DB connections.
  const CHUNK_SIZE = 50;
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);

    await Promise.allSettled(
      chunk.map((userId) =>
        // Re-use triggerNotification's per-user logic for channel resolution
        // + async enqueue, BUT the Notification rows were already created by
        // triggerBulkNotification — so here we only need to drive the
        // PUSH/SMS/EMAIL sends. We look up each user's pending deliveries
        // and send them directly rather than re-creating notifications.
        dispatchPendingDeliveriesForUser(userId, event, vars, locale ?? "en", extraData),
      ),
    );
  }
}

/**
 * For bulk fan-out, Notification + NotificationDelivery rows already exist
 * (created synchronously in triggerBulkNotification for consistent inbox
 * state). This finds the most recent matching notification for the user and
 * drives its pending async deliveries.
 */
async function dispatchPendingDeliveriesForUser(
  userId: string,
  event: NotificationEvent,
  vars: Record<string, string | number>,
  locale: SupportedLocale,
  _extraData?: Record<string, unknown>,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const notification = await prisma.notification.findFirst({
    where: { userId, event },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deliveries: {
        where: { status: "PENDING", channel: { not: "IN_APP" } },
        select: { channel: true },
      },
    },
  });

  if (!notification || notification.deliveries.length === 0) return;

  await Promise.allSettled(
    notification.deliveries.map((d) =>
      sendChannel(notification.id, userId, event, d.channel, vars, locale),
    ),
  );
}

notificationWorker.on("failed", (job, err) => {
  console.error(`Notification job ${job?.id} (${job?.name}) failed:`, err.message);
});

// Re-export for the standalone worker entrypoint.
export { triggerNotification };
