import "server-only";
import { Worker, Job } from "bullmq";
import { redisConnection } from "@/lib/queue/queues";
import { prisma } from "@/lib/prisma";
import { triggerNotification } from "@/lib/notifications/dispatcher";

/**
 * Daily job (scheduled via scheduleDocumentExpiryChecks in queues.ts):
 *  - Documents expiring in exactly 30, 14, 7, or 1 day(s) → DOCUMENT_EXPIRING
 *  - Documents that expired as of today and haven't yet been flagged →
 *    DOCUMENT_EXPIRED + flips RiderProfile to offline.
 *
 * Reminder thresholds (30/14/7/1) chosen to give riders enough lead time to
 * renew NTSA/insurance docs without spamming daily.
 */

const REMINDER_THRESHOLDS_DAYS = [30, 14, 7, 1];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DRIVING_LICENSE: "Driving License",
  PSV_BADGE: "PSV/NTSA Badge",
  INSURANCE: "Insurance Certificate",
  LOGBOOK: "Motorcycle Logbook",
  NATIONAL_ID: "National ID",
};

export const documentExpiryWorker = new Worker(
  "document-expiry",
  async (job: Job) => {
    if (job.name !== "check-expiring-documents") return;
    await runExpiryCheck();
  },
  { connection: redisConnection, concurrency: 1 },
);

async function runExpiryCheck(): Promise<void> {
  const today = startOfDay(new Date());

  await Promise.all([
    notifyExpiringDocuments(today),
    notifyAndOfflineExpiredDocuments(today),
  ]);
}

async function notifyExpiringDocuments(today: Date): Promise<void> {
  for (const days of REMINDER_THRESHOLDS_DAYS) {
    const targetDate = addDays(today, days);
    const rangeStart = startOfDay(targetDate);
    const rangeEnd = addDays(rangeStart, 1);

    const docs = await prisma.document.findMany({
      where: {
        expiryDate: { gte: rangeStart, lt: rangeEnd },
        verificationStatus: "VERIFIED",
      },
      select: {
        id: true,
        type: true,
        expiryDate: true,
        riderProfile: { select: { userId: true } },
      },
    });

    for (const doc of docs) {
      if (!doc.expiryDate || !doc.riderProfile) continue;

      await triggerNotification({
        userId: doc.riderProfile.userId,
        event: "DOCUMENT_EXPIRING",
        vars: {
          documentType: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type,
          expiryDate: formatDate(doc.expiryDate),
          daysRemaining: days,
        },
        data: { documentId: doc.id, documentType: doc.type, daysRemaining: days },
      });
    }
  }
}

async function notifyAndOfflineExpiredDocuments(today: Date): Promise<void> {
  // Documents that expired before today, are still marked VERIFIED (i.e. we
  // haven't processed their expiry yet), and belong to a rider currently
  // online — these get DOCUMENT_EXPIRED + forced offline.
  const expiredDocs = await prisma.document.findMany({
    where: {
      expiryDate: { lt: today },
      verificationStatus: "VERIFIED",
    },
    select: {
      id: true,
      type: true,
      expiryDate: true,
      riderProfile: { select: { userId: true, id: true, onlineStatus: true } },
    },
  });

  for (const doc of expiredDocs) {
    if (!doc.expiryDate || !doc.riderProfile) continue;

    await prisma.$transaction([
      prisma.document.update({
        where: { id: doc.id },
        data: { verificationStatus: "EXPIRED" },
      }),
      prisma.riderProfile.update({
        where: { id: doc.riderProfile.id },
        data: { onlineStatus: "OFFLINE" },
      }),
    ]);

    await triggerNotification({
      userId: doc.riderProfile.userId,
      event: "DOCUMENT_EXPIRED",
      vars: {
        documentType: DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type,
        expiryDate: formatDate(doc.expiryDate),
      },
      data: { documentId: doc.id, documentType: doc.type },
    });
  }
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

documentExpiryWorker.on("failed", (job, err) => {
  console.error(`Document expiry job ${job?.id} failed:`, err.message);
});
