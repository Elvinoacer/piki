// lib/payments/jobs.ts
// BullMQ background jobs for payment operations
// Requires: npm install bullmq ioredis

import { Queue, Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import { b2cPayout } from "./daraja";
import { creditWallet } from "./wallet";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379"),
  password: process.env.REDIS_PASSWORD,
};

// ----------------------------------------------------------------
// Queue definitions
// ----------------------------------------------------------------
export const payoutQueue = new Queue("payouts", { connection });
export const receiptQueue = new Queue("receipts", { connection });

// ----------------------------------------------------------------
// Job types
// ----------------------------------------------------------------
interface PayoutJobData {
  payoutId: string;
}

interface ReceiptJobData {
  tripId: string;
  paymentId: string;
}

// ----------------------------------------------------------------
// Scheduled payout processor
// Processes payouts that were queued (e.g. daily batch)
// ----------------------------------------------------------------
export function startPayoutWorker() {
  return new Worker<PayoutJobData>(
    "payouts",
    async (job: Job<PayoutJobData>) => {
      const { payoutId } = job.data;

      const payout = await prisma.payout.findUnique({
        where: { id: payoutId },
        include: { rider: true },
      });

      if (!payout) throw new Error(`Payout ${payoutId} not found`);
      if (payout.status !== "PENDING") {
        console.log(`[payout-worker] Payout ${payoutId} already ${payout.status}, skipping`);
        return;
      }

      await prisma.payout.update({
        where: { id: payoutId },
        data: { status: "PROCESSING" },
      });

      const b2cResponse = await b2cPayout({
        phone: payout.mpesaPhone,
        amount: Number(payout.amount),
        remarks: "Pikii earnings payout",
        occasion: `Payout-${payout.id.slice(-8)}`,
      });

      await prisma.payout.update({
        where: { id: payoutId },
        data: { mpesaB2cRef: b2cResponse.ConversationID },
      });

      console.log(`[payout-worker] Initiated B2C for payout ${payoutId}`);
    },
    {
      connection,
      concurrency: 5,
      // Retry 3x with exponential backoff
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    }
  );
}

// ----------------------------------------------------------------
// Schedule pending payouts (call on a cron — e.g. every night at 11pm EAT)
// ----------------------------------------------------------------
export async function scheduleDailyPayouts() {
  const pendingPayouts = await prisma.payout.findMany({
    where: { status: "PENDING" },
  });

  for (const payout of pendingPayouts) {
    await payoutQueue.add(
      "process-payout",
      { payoutId: payout.id },
      { jobId: `payout-${payout.id}` } // deduplication
    );
  }

  console.log(`[schedule-payouts] Queued ${pendingPayouts.length} payouts`);
}

// ----------------------------------------------------------------
// Receipt generation worker (decoupled from API response)
// ----------------------------------------------------------------
export function startReceiptWorker() {
  return new Worker<ReceiptJobData>(
    "receipts",
    async (job: Job<ReceiptJobData>) => {
      const { tripId, paymentId } = job.data;

      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { client: true, rider: { include: { riderProfile: true } } },
      });

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!trip || !payment) return;

      const { generateReceiptAndNotify } = await import("./receipt-dispatcher");
      await generateReceiptAndNotify(trip, payment);
    },
    { connection }
  );
}

// ----------------------------------------------------------------
// Retry stalled PROCESSING payouts (safety net — run every hour)
// ----------------------------------------------------------------
export async function retryStuckPayouts() {
  const stuckThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  const stuck = await prisma.payout.findMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: stuckThreshold },
    },
  });

  for (const payout of stuck) {
    console.warn(
      `[retry-stuck-payouts] Payout ${payout.id} stuck in PROCESSING, resetting to PENDING`
    );
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "PENDING", failureReason: "Reset from stuck PROCESSING" },
    });
  }
}
