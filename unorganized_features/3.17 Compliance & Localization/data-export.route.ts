// app/api/compliance/data-export/route.ts
// POST /api/compliance/data-export
// Enqueues a data export job (DPA §34 — right to data portability).
// The actual export is built by a BullMQ worker and delivered via email/download.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dataExportQueue } from "@/lib/queues"; // BullMQ queue instance

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent duplicate pending requests
  const existing = await prisma.dataExportRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ["pending", "processing"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { message: "An export is already being prepared.", requestId: existing.id },
      { status: 202 }
    );
  }

  const exportRequest = await prisma.dataExportRequest.create({
    data: {
      userId: session.user.id,
      status: "pending",
      requestedAt: new Date(),
    },
  });

  // Enqueue background job (BullMQ)
  await dataExportQueue.add("build-export", {
    userId: session.user.id,
    requestId: exportRequest.id,
  });

  return NextResponse.json(
    {
      message: "Your export is being prepared. You'll be notified within 72 hours.",
      requestId: exportRequest.id,
    },
    { status: 202 }
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request = await prisma.dataExportRequest.findFirst({
    where: { userId: session.user.id },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(request ?? null);
}
