// src/app/api/sacco/[saccoId]/analytics/route.ts
// GET /api/sacco/:saccoId/analytics?period=today|week|month

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getFleetAnalytics } from "@/lib/sacco/queries";

async function guardSaccoMember(userId: string, saccoId: string) {
  const m = await prisma.saccoAdmin.findUnique({
    where: { userId_saccoId: { userId, saccoId } },
  });
  return !!m;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const isMember = await guardSaccoMember(session.user.id, params.saccoId);
  if (!isMember)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rawPeriod = req.nextUrl.searchParams.get("period") ?? "week";
  const period = ["today", "week", "month"].includes(rawPeriod)
    ? (rawPeriod as "today" | "week" | "month")
    : "week";

  const data = await getFleetAnalytics(params.saccoId, period);
  return NextResponse.json(data);
}
