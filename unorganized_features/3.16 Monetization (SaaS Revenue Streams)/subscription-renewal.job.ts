// lib/jobs/subscription-renewal.job.ts
// BullMQ worker that processes subscription renewals.
// Add this to your job queue bootstrap (e.g. lib/jobs/index.ts).

import { Worker, Queue, QueueScheduler } from "bullmq";
import { connection } from "@/lib/redis"; // your Redis/Upstash connection
import { prisma } from "@/lib/prisma";
import { renewSubscription } from "@/lib/monetization/subscription-service";

export const RENEWAL_QUEUE_NAME = "subscription-renewal";

// ─── Queue (use this in cron/scheduler to enqueue jobs) ──────────
export const renewalQueue = new Queue(RENEWAL_QUEUE_NAME, { connection });

// ─── Scheduler (required for delayed/repeatable jobs) ────────────
export const renewalScheduler = new QueueScheduler(RENEWAL_QUEUE_NAME, {
  connection,
});

// ─── Worker ───────────────────────────────────────────────────────
export const renewalWorker = new Worker(
  RENEWAL_QUEUE_NAME,
  async (job) => {
    const { subscriptionId } = job.data as { subscriptionId: string };

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, user: true },
    });

    if (!sub || sub.status !== "ACTIVE") {
      console.log(`[renewal] Skipping ${subscriptionId} — not active.`);
      return;
    }

    // In production: initiate M-Pesa STK Push here and wait for callback.
    // For now, we mock a successful payment ref.
    const mockPaymentRef = `RENEWAL_${Date.now()}_${subscriptionId.slice(0, 8)}`;

    try {
      await renewSubscription(subscriptionId, mockPaymentRef);
      console.log(`[renewal] Renewed ${subscriptionId} — ref: ${mockPaymentRef}`);
    } catch (err) {
      console.error(`[renewal] Failed to renew ${subscriptionId}:`, err);
      // Mark as PAST_DUE so the user is notified
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: "PAST_DUE" },
      });
      throw err; // re-throw so BullMQ retries
    }
  },
  { connection, concurrency: 5 }
);

// ─── Enqueue due renewals (run via a cron every hour) ────────────
/**
 * Called by a cron handler (e.g. an API route hit by Vercel Cron or a BullMQ repeatable job).
 * Finds subscriptions due for renewal in the next hour and enqueues them.
 */
export async function enqueueDueRenewals() {
  const horizon = new Date(Date.now() + 60 * 60 * 1000); // next hour

  const due = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      nextRenewalAt: { lte: horizon },
    },
    select: { id: true },
  });

  const jobs = due.map(({ id }) =>
    renewalQueue.add(
      "renew",
      { subscriptionId: id },
      {
        jobId: `renew-${id}`,        // deduplicate
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      }
    )
  );

  await Promise.all(jobs);
  console.log(`[renewal-cron] Enqueued ${jobs.length} renewal jobs.`);
  return jobs.length;
}
