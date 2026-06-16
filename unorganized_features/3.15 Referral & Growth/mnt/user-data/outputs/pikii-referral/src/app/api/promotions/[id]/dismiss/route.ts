// src/app/api/promotions/[id]/dismiss/route.ts
// POST — record that the user dismissed this banner
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  await prisma.promotionDismissal
    .upsert({
      where: { promotionId_userId: { promotionId: params.id, userId: session.user.id } },
      create: { promotionId: params.id, userId: session.user.id },
      update: {},
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
