import { prisma } from "@/lib/prisma";

// =====================================================================================
// Document Expiry Check Job
// -------------------------------------------------------------------------------------
// Implements the data side of 3.9 "Document expiry alerts (license,
// insurance renewal reminders)" and the compliance gate implied by 3.1
// ("expiry tracking" on driving license / insurance / PSV badge).
//
// This module exposes a pure function `runDocumentExpiryCheck()` so it can
// be invoked either:
//   - from a BullMQ repeatable job/worker (per PRD 4.1 "Background Jobs:
//     Queue system (BullMQ + Redis) for ... document-expiry checks") once
//     that worker process is wired up, or
//   - directly via a cron-style scheduled invocation (e.g. `tsx
//     src/jobs/document-expiry-check.ts`) for environments without BullMQ
//     set up yet.
//
// Behavior:
//   1. EXPIRING SOON (within 7 days): returns a list for the notification
//      service (3.13) to send reminders. Does not change any status.
//   2. EXPIRED (expiresAt in the past) AND the document is currently
//      APPROVED: flips Document.status -> EXPIRED, and if this was a
//      required document for the rider's vehicleType, downgrades the
//      RiderProfile.verificationStatus from APPROVED to SUSPENDED (a
//      currently-online rider with an expired license/insurance should not
//      keep operating — matching (3.2) must check verificationStatus, which
//      it already does per the contract in onboarding.service.ts).
//
// This file intentionally does NOT send notifications itself — it returns
// structured results so the caller (a future BullMQ processor wired to
// 3.13's dispatch service) can fan out SMS/push without this job needing to
// import the entire notifications stack.
// =====================================================================================

import { getRequiredDocumentTypes } from "@/lib/services/onboarding.service";

const EXPIRY_REMINDER_WINDOW_DAYS = 7;

export interface ExpiringDocumentNotice {
  riderId: string;
  userId: string;
  documentId: string;
  documentType: string;
  expiresAt: Date;
  daysUntilExpiry: number;
}

export interface SuspendedRiderNotice {
  riderId: string;
  userId: string;
  documentId: string;
  documentType: string;
  expiresAt: Date;
}

export interface DocumentExpiryCheckResult {
  expiringSoon: ExpiringDocumentNotice[];
  newlyExpiredSuspensions: SuspendedRiderNotice[];
}

export async function runDocumentExpiryCheck(now: Date = new Date()): Promise<DocumentExpiryCheckResult> {
  const reminderCutoff = new Date(now.getTime() + EXPIRY_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // --- 1. Expiring soon (reminder candidates) -------------------------------------
  const expiringSoonDocs = await prisma.document.findMany({
    where: {
      isActive: true,
      status: "APPROVED",
      expiresAt: { gt: now, lte: reminderCutoff },
    },
    include: { rider: { select: { id: true, userId: true } } },
  });

  const expiringSoon: ExpiringDocumentNotice[] = expiringSoonDocs.map((doc) => ({
    riderId: doc.rider.id,
    userId: doc.rider.userId,
    documentId: doc.id,
    documentType: doc.type,
    expiresAt: doc.expiresAt!,
    daysUntilExpiry: Math.ceil((doc.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
  }));

  // --- 2. Newly expired (already past expiresAt, still marked APPROVED) -----------
  const newlyExpiredDocs = await prisma.document.findMany({
    where: { isActive: true, status: "APPROVED", expiresAt: { lte: now } },
    include: { rider: true },
  });

  const newlyExpiredSuspensions: SuspendedRiderNotice[] = [];

  for (const doc of newlyExpiredDocs) {
    await prisma.document.update({ where: { id: doc.id }, data: { status: "EXPIRED" } });

    const requiredTypes = getRequiredDocumentTypes(doc.rider.vehicleType);
    const isRequiredDoc = requiredTypes.includes(doc.type);

    if (isRequiredDoc && doc.rider.verificationStatus === "APPROVED") {
      await prisma.$transaction([
        prisma.riderProfile.update({
          where: { id: doc.rider.id },
          data: {
            verificationStatus: "SUSPENDED",
            availability: "OFFLINE",
            rejectionReason: `${doc.type} expired on ${doc.expiresAt?.toISOString().slice(0, 10)}.`,
          },
        }),
        prisma.riderVerificationReview.create({
          data: {
            riderId: doc.rider.id,
            reviewerId: null,
            method: "AI_AUTOMATED",
            decision: "SUSPENDED",
            notes: `Automatic suspension: ${doc.type} expired.`,
          },
        }),
      ]);

      newlyExpiredSuspensions.push({
        riderId: doc.rider.id,
        userId: doc.rider.userId,
        documentId: doc.id,
        documentType: doc.type,
        expiresAt: doc.expiresAt!,
      });
    }
  }

  return { expiringSoon, newlyExpiredSuspensions };
}

// Allow direct invocation: `tsx src/jobs/document-expiry-check.ts`
if (require.main === module) {
  runDocumentExpiryCheck()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log(
        `Document expiry check complete. ${result.expiringSoon.length} expiring soon, ` +
          `${result.newlyExpiredSuspensions.length} riders newly suspended.`
      );
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Document expiry check failed:", err);
      process.exit(1);
    });
}
