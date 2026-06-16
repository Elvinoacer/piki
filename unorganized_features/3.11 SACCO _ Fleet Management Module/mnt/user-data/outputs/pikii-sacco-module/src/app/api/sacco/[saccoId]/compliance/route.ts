// src/app/api/sacco/[saccoId]/compliance/route.ts
// GET /api/sacco/:saccoId/compliance

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getComplianceReport } from "@/lib/sacco/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const m = await prisma.saccoAdmin.findUnique({
    where: { userId_saccoId: { userId: session.user.id, saccoId: params.saccoId } },
  });
  if (!m) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const report = await getComplianceReport(params.saccoId);
  return NextResponse.json(report);
}
