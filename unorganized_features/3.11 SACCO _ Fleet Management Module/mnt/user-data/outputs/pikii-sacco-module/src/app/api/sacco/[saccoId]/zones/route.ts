// src/app/api/sacco/[saccoId]/zones/route.ts
// GET  /api/sacco/:saccoId/zones           — list all zones with rider counts
// POST /api/sacco/:saccoId/zones/assign    — assign riders to a zone
// POST /api/sacco/:saccoId/zones/remove    — remove a rider from a zone

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSaccoZones } from "@/lib/sacco/queries";
import { assignRidersToZone, removeRiderFromZone } from "@/lib/sacco/actions";

async function guard(userId: string, saccoId: string) {
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
    await guard(session.user.id, params.saccoId);
    const zones = await getSaccoZones(params.saccoId);
    return NextResponse.json(zones);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
}

// src/app/api/sacco/[saccoId]/zones/assign/route.ts
// (co-located here for brevity; split into separate file in project)
export async function POST(
  req: NextRequest,
  { params }: { params: { saccoId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action as "assign" | "remove";

    if (action === "assign") {
      const result = await assignRidersToZone(params.saccoId, {
        riderProfileIds: body.riderProfileIds,
        zoneId: body.zoneId,
      });
      return NextResponse.json(result);
    }

    if (action === "remove") {
      const result = await removeRiderFromZone(params.saccoId, {
        riderProfileId: body.riderProfileId,
        zoneId: body.zoneId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
