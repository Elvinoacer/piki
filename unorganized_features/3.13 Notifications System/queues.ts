import "server-only";
import { Queue } from "bullmq";
import IORedis from "ioredis";

/**
 * Shared Redis connection for BullMQ. Reused across all queues/workers to
 * avoid exhausting connections (especially on Upstash's connection limits).
 *
 * Required env var: REDIS_URL (e.g. rediss://default:xxx@xxx.upstash.io:6379)
 */
export const redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
});

/**
 * Main notification dispatch queue. Jobs:
 *  - "dispatch-channels": send PUSH/SMS/EMAIL for a single Notification
 *  - "dispatch-bulk": fan out a broadcast/promo to many users
 *
 * See src/lib/queue/workers/notifications.ts for the worker.
 */
export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

/**
 * Repeating queue for the document-expiry checker. A single repeatable job
 * scans Document rows nearing expiry and triggers DOCUMENT_EXPIRING /
 * DOCUMENT_EXPIRED notifications. Scheduled via scheduleDocumentExpiryChecks()
 * — call once at deploy time (e.g. in an instrumentation hook or admin script).
 */
export const documentExpiryQueue = new Queue("document-expiry", {
  connection: redisConnection,
});

export async function scheduleDocumentExpiryChecks(): Promise<void> {
  await documentExpiryQueue.add(
    "check-expiring-documents",
    {},
    {
      repeat: { pattern: "0 6 * * *" }, // daily at 06:00 — before riders start their day
      jobId: "document-expiry-daily", // fixed id prevents duplicate schedules on redeploy
    },
  );
}
