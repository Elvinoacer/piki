// app/api/compliance/account-deletion/route.ts
// POST /api/compliance/account-deletion
// Schedules account deletion after a cooling-off period (DPA §34 — right to erasure).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DELETION_COOLING_OFF_DAYS, redactUserPii } from "@/lib/compliance/dpa";
import { accountDeletionQueue } from "@/lib/queues";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const reason: string | undefined = body?.reason;

  // Block if there's an active trip
  const activeTrip = await prisma.trip.findFirst({
    where: {
      OR: [{ riderId: session.user.id }, { clientId: session.user.id }],
      status: { in: ["REQUESTED", "ACCEPTED", "ARRIVING", "IN_PROGRESS"] },
    },
  });

  if (activeTrip) {
    return NextResponse.json(
      { error: "You have an active trip. Please complete or cancel it before deleting your account." },
      { status: 409 }
    );
  }

  // Block if there's an outstanding wallet balance
  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (wallet && wallet.balance > 0) {
    return NextResponse.json(
      {
        error: `You have a wallet balance of KES ${wallet.balance.toFixed(2)}. Please withdraw before deleting your account.`,
      },
      { status: 409 }
    );
  }

  // Prevent duplicate pending deletion requests
  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: session.user.id, status: { in: ["pending", "scheduled"] } },
  });

  if (existing) {
    return NextResponse.json(
      { message: "A deletion request is already pending.", scheduledAt: existing.scheduledAt },
      { status: 202 }
    );
  }

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + DELETION_COOLING_OFF_DAYS);

  const deletionRequest = await prisma.accountDeletionRequest.create({
    data: {
      userId: session.user.id,
      requestedAt: new Date(),
      scheduledAt,
      status: "scheduled",
      reason: reason ?? null,
    },
  });

  // Enqueue deletion job with delay equal to cooling-off period
  await accountDeletionQueue.add(
    "delete-account",
    { userId: session.user.id, requestId: deletionRequest.id },
    { delay: DELETION_COOLING_OFF_DAYS * 24 * 60 * 60 * 1000 }
  );

  return NextResponse.json(
    {
      message: `Your account will be permanently deleted on ${scheduledAt.toDateString()}. You can cancel this request before then.`,
      requestId: deletionRequest.id,
      scheduledAt: scheduledAt.toISOString(),
    },
    { status: 202 }
  );
}

/** Cancel a pending deletion request */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.accountDeletionRequest.findFirst({
    where: { userId: session.user.id, status: { in: ["pending", "scheduled"] } },
  });

  if (!request) {
    return NextResponse.json({ error: "No pending deletion request found." }, { status: 404 });
  }

  await prisma.accountDeletionRequest.update({
    where: { id: request.id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ message: "Account deletion cancelled." });
}
