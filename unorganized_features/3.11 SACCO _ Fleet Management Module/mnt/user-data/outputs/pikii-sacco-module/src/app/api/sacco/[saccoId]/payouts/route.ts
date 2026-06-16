// src/app/api/sacco/[saccoId]/payouts/route.ts
// GET  /api/sacco/:saccoId/payouts         — list payout batches
// POST /api/sacco/:saccoId/payouts         — initiate a new payout batch

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  getSaccoPayoutBatches,
  getRidersPendingPayout,
} from "@/lib/sacco/queries";
import { initiatePayoutBatch } from "@/lib/sacco/actions";

async function guard(userId: string, saccoId: string) {
  const m = await prisma.saccoAdmin.findUnique({
    where: { userId_saccoId: { userId, saccoId } },
  });
  if (!m) throw new Error("Forbidden");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    await guard(session.user.id, params.saccoId);

    const view = req.nextUrl.searchParams.get("view");

    // ?view=pending returns riders with unpaid earnings
    if (view === "pending") {
      const pending = await getRidersPendingPayout(params.saccoId);
      return NextResponse.json(pending);
    }

    const batches = await getSaccoPayoutBatches(params.saccoId);
    return NextResponse.json(batches);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const result = await initiatePayoutBatch(params.saccoId, {
      riderProfileIds: body.riderProfileIds,
      note: body.note,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
