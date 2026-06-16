// src/lib/sacco/actions.ts
// Next.js Server Actions for all SACCO write operations

"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type {
  SetCommissionInput,
  AssignZoneInput,
  RemoveZoneInput,
  InitiatePayoutBatchInput,
  BulkVerifyInput,
  OnboardRiderToSaccoInput,
  RemoveRiderFromSaccoInput,
} from "@/types/sacco";

// ── Auth guard ───────────────────────────────────────────────

async function requireSaccoAdmin(saccoId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const membership = await prisma.saccoAdmin.findUnique({
    where: {
      userId_saccoId: { userId: session.user.id, saccoId },
    },
  });
  if (!membership) throw new Error("Not a SACCO admin for this organisation");
  return { userId: session.user.id, role: membership.role };
}

// ── Rider onboarding ─────────────────────────────────────────

export async function onboardRiderToSacco(
  saccoId: string,
  input: OnboardRiderToSaccoInput
) {
  await requireSaccoAdmin(saccoId);

  const rider = await prisma.riderProfile.findUnique({
    where: { id: input.riderProfileId },
  });
  if (!rider) throw new Error("Rider not found");
  if (rider.saccoId && rider.saccoId !== saccoId)
    throw new Error("Rider already belongs to another SACCO");

  await prisma.riderProfile.update({
    where: { id: input.riderProfileId },
    data: {
      saccoId,
      saccoStatus: "ACTIVE",
      saccoJoinedAt: rider.saccoJoinedAt ?? new Date(),
    },
  });

  revalidatePath(`/sacco/${saccoId}/riders`);
  return { success: true };
}

export async function removeRiderFromSacco(
  saccoId: string,
  input: RemoveRiderFromSaccoInput
) {
  await requireSaccoAdmin(saccoId);

  await prisma.riderProfile.update({
    where: { id: input.riderProfileId, saccoId },
    data: { saccoStatus: "REMOVED" },
  });

  // Remove all active zone assignments
  await prisma.zoneAssignment.updateMany({
    where: {
      riderProfileId: input.riderProfileId,
      saccoId,
      removedAt: null,
    },
    data: { removedAt: new Date() },
  });

  revalidatePath(`/sacco/${saccoId}/riders`);
  return { success: true };
}

// ── Commission rules ─────────────────────────────────────────

export async function setCommissionRule(
  saccoId: string,
  input: SetCommissionInput
) {
  await requireSaccoAdmin(saccoId);

  // Expire any existing active rule for this target
  await prisma.commissionRule.updateMany({
    where: {
      saccoId,
      riderProfileId: input.riderProfileId ?? null,
      effectiveTo: null,
    },
    data: { effectiveTo: new Date() },
  });

  await prisma.commissionRule.create({
    data: {
      saccoId,
      riderProfileId: input.riderProfileId ?? null,
      platformCommissionPct: input.platformCommissionPct,
      saccoCommissionPct: input.saccoCommissionPct,
      effectiveFrom: new Date(),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      note: input.note ?? null,
    },
  });

  revalidatePath(`/sacco/${saccoId}/riders`);
  return { success: true };
}

// ── Zone assignments ──────────────────────────────────────────

export async function assignRidersToZone(
  saccoId: string,
  input: AssignZoneInput
) {
  const { userId } = await requireSaccoAdmin(saccoId);

  // Upsert zone assignments
  await prisma.$transaction(
    input.riderProfileIds.map((riderProfileId) =>
      prisma.zoneAssignment.upsert({
        where: { riderProfileId_zoneId: { riderProfileId, zoneId: input.zoneId } },
        create: {
          saccoId,
          riderProfileId,
          zoneId: input.zoneId,
          assignedBy: userId,
          removedAt: null,
        },
        update: {
          removedAt: null,
          assignedAt: new Date(),
          assignedBy: userId,
        },
      })
    )
  );

  revalidatePath(`/sacco/${saccoId}/zones`);
  return { success: true };
}

export async function removeRiderFromZone(
  saccoId: string,
  input: RemoveZoneInput
) {
  await requireSaccoAdmin(saccoId);

  await prisma.zoneAssignment.updateMany({
    where: {
      saccoId,
      riderProfileId: input.riderProfileId,
      zoneId: input.zoneId,
      removedAt: null,
    },
    data: { removedAt: new Date() },
  });

  revalidatePath(`/sacco/${saccoId}/zones`);
  return { success: true };
}

// ── Bulk document verification ────────────────────────────────

export async function runBulkVerification(
  saccoId: string,
  input: BulkVerifyInput
) {
  const { userId } = await requireSaccoAdmin(saccoId);

  const job = await prisma.bulkVerificationJob.create({
    data: {
      saccoId,
      initiatedBy: userId,
      totalCount: input.items.length,
      status: "IN_PROGRESS",
    },
  });

  let processed = 0;
  for (const item of input.items) {
    await prisma.$transaction([
      // Record the item result
      prisma.bulkVerificationItem.create({
        data: {
          jobId: job.id,
          documentId: item.documentId,
          result: item.result,
          reviewNote: item.reviewNote ?? null,
          processedAt: new Date(),
        },
      }),
      // Update the document's verification status
      prisma.document.update({
        where: { id: item.documentId },
        data: {
          verificationStatus:
            item.result === "APPROVED"
              ? "APPROVED"
              : item.result === "REJECTED"
              ? "REJECTED"
              : "PENDING",
        },
      }),
    ]);
    processed++;
  }

  await prisma.bulkVerificationJob.update({
    where: { id: job.id },
    data: {
      processedCount: processed,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  revalidatePath(`/sacco/${saccoId}/riders`);
  revalidatePath(`/sacco/${saccoId}/compliance`);
  return { success: true, jobId: job.id };
}

// ── Payout batch ──────────────────────────────────────────────

export async function initiatePayoutBatch(
  saccoId: string,
  input: InitiatePayoutBatchInput
) {
  const { userId } = await requireSaccoAdmin(saccoId);

  // Verify sacco is set to manage its own payouts
  const sacco = await prisma.saccoOrg.findUnique({ where: { id: saccoId } });
  if (!sacco) throw new Error("SACCO not found");
  if (sacco.payoutManagedBy !== "SACCO")
    throw new Error("Payouts for this SACCO are managed by the platform");

  // Get current wallet balances for selected riders
  const riders = await prisma.riderProfile.findMany({
    where: { id: { in: input.riderProfileIds }, saccoId, saccoStatus: "ACTIVE" },
    include: {
      wallet: true,
      user: { select: { phone: true } },
    },
  });

  const totalAmount = riders.reduce(
    (s, r) => s + Number(r.wallet?.balance ?? 0),
    0
  );
  if (totalAmount <= 0) throw new Error("No payable balances selected");

  // Create batch + individual payout records in a transaction
  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.saccoPayoutBatch.create({
      data: {
        saccoId,
        initiatedBy: userId,
        totalAmount,
        status: "PENDING",
        note: input.note ?? null,
      },
    });

    for (const rider of riders) {
      const amount = Number(rider.wallet?.balance ?? 0);
      if (amount <= 0) continue;

      await tx.payout.create({
        data: {
          riderProfileId: rider.id,
          amount,
          status: "PENDING",
          saccoId,
          saccoPayoutBatchId: b.id,
          mpesaPhone: rider.user.phone,
        },
      });

      // Zero wallet balance (will be confirmed on B2C callback)
      await tx.wallet.update({
        where: { userId: rider.userId },
        data: { balance: { decrement: amount } },
      });
    }

    return b;
  });

  // TODO: trigger BullMQ job to process M-Pesa B2C for each payout in the batch
  // await payoutQueue.add("process-sacco-batch", { batchId: batch.id });

  revalidatePath(`/sacco/${saccoId}/payouts`);
  return { success: true, batchId: batch.id };
}

// ── SACCO org settings ────────────────────────────────────────

export async function updateSaccoSettings(
  saccoId: string,
  data: {
    name?: string;
    contactPhone?: string;
    contactEmail?: string;
    platformCommissionPct?: number;
    saccoCommissionPct?: number;
    payoutManagedBy?: "PLATFORM" | "SACCO";
  }
) {
  await requireSaccoAdmin(saccoId);

  await prisma.saccoOrg.update({
    where: { id: saccoId },
    data,
  });

  revalidatePath(`/sacco/${saccoId}`);
  return { success: true };
}
