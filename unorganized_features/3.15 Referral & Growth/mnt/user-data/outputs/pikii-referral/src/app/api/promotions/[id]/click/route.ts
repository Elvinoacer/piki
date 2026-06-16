// src/app/api/promotions/[id]/click/route.ts
// POST — record a click on a promotion banner
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.promotion
    .update({
      where: { id: params.id },
      data: { clicks: { increment: 1 } },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
