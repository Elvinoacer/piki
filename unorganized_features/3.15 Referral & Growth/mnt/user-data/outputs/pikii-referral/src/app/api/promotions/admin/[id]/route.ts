// src/app/api/promotions/admin/[id]/route.ts
// PATCH  — update a promotion
// DELETE — soft-delete (set isActive = false)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!session?.user?.id || session.user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  ctaLabel: z.string().max(50).optional().nullable(),
  ctaUrl: z.string().url().optional().nullable(),
  targetRole: z.enum(["ALL", "CLIENT", "RIDER"]).optional(),
  placement: z.enum(["HOME", "BOOKING", "PAYMENT", "EARNINGS", "PROFILE"]).optional(),
  priority: z.number().int().min(0).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  promoCodeId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = requireAdmin(session);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.startsAt) data.startsAt = new Date(data.startsAt as string);
  if (data.endsAt) data.endsAt = new Date(data.endsAt as string);

  const promotion = await prisma.promotion.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json({ promotion });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const guard = requireAdmin(session);
  if (guard) return guard;

  await prisma.promotion.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
