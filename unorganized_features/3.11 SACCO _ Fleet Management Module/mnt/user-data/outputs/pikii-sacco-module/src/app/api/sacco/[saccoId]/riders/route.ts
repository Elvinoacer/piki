// src/app/api/sacco/[saccoId]/riders/route.ts
// GET  /api/sacco/:saccoId/riders          — list fleet riders
// POST /api/sacco/:saccoId/riders          — onboard a rider
// DELETE /api/sacco/:saccoId/riders        — remove a rider

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSaccoRiders } from "@/lib/sacco/queries";
import {
  onboardRiderToSacco,
  removeRiderFromSacco,
} from "@/lib/sacco/actions";

async function guardSaccoAdmin(userId: string, saccoId: string) {
  const m = await prisma.saccoAdmin.findUnique({
    where: { userId_saccoId: { userId, saccoId } },
  });
  if (!m) throw new Error("Forbidden");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    await guardSaccoAdmin(session.user.id, params.saccoId);
    const riders = await getSaccoRiders(params.saccoId);
    return NextResponse.json(riders);
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
    const result = await onboardRiderToSacco(params.saccoId, {
      riderProfileId: body.riderProfileId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const result = await removeRiderFromSacco(params.saccoId, {
      riderProfileId: body.riderProfileId,
      reason: body.reason,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
