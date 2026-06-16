// app/api/compliance/kra-export/route.ts
// POST /api/compliance/kra-export
// Returns a CSV or triggers a PDF generation job for KRA tax records.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  periodToDateRange,
  buildCsv,
  summarizeTransactions,
  type KraTransaction,
  type KraExportOptions,
} from "@/lib/compliance/kra";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<KraExportOptions>;
  const { period, year, month, quarter, format } = body;

  if (!period || !year || !format) {
    return NextResponse.json({ error: "Missing required fields: period, year, format" }, { status: 400 });
  }

  let from: Date, to: Date;
  try {
    ({ from, to } = periodToDateRange({ period, year, month, quarter }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  // Fetch completed/refunded trips for this rider in the date range
  const payments = await prisma.payment.findMany({
    where: {
      trip: {
        riderId: session.user.id,
        completedAt: { gte: from, lte: to },
        status: { in: ["COMPLETED", "REFUNDED"] },
      },
    },
    include: {
      trip: {
        select: {
          id: true,
          completedAt: true,
          pickupAddress: true,
          dropoffAddress: true,
          commissionAmount: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const transactions: KraTransaction[] = payments.map((p) => ({
    date: (p.trip.completedAt ?? p.createdAt).toISOString().split("T")[0],
    tripId: p.trip.id,
    description: `${p.trip.pickupAddress} → ${p.trip.dropoffAddress}`,
    grossAmount: p.amount,
    commissionAmount: p.trip.commissionAmount ?? 0,
    netAmount: p.amount - (p.trip.commissionAmount ?? 0),
    mpesaRef: p.mpesaReceiptRef ?? undefined,
    paymentMethod: p.method as KraTransaction["paymentMethod"],
    status: p.trip.status as KraTransaction["status"],
  }));

  const rider = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, riderProfile: { select: { kraPin: true } } },
  });

  if (format === "csv") {
    const csv = buildCsv(transactions, rider?.name ?? "Rider", rider?.riderProfile?.kraPin ?? undefined);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pikii-kra-${period}-${year}.csv"`,
      },
    });
  }

  // PDF: return summary JSON — client triggers a separate PDF render
  const summary = summarizeTransactions(transactions);
  return NextResponse.json({
    transactions,
    summary,
    riderName: rider?.name ?? "",
    kraPin: rider?.riderProfile?.kraPin ?? null,
    period: { from: from.toISOString(), to: to.toISOString() },
  });
}
