// src/app/api/promotions/admin/route.ts
// GET  — paginated list of all promotions (admin)
// POST — create a new promotion (admin)
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = requireAdmin(session);
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = 20;

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      include: { promoCode: { select: { code: true } }, createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.promotion.count(),
  ]);

  return NextResponse.json({ promotions, total, page, pageSize });
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  ctaLabel: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  targetRole: z.enum(["ALL", "CLIENT", "RIDER"]).default("ALL"),
  placement: z.enum(["HOME", "BOOKING", "PAYMENT", "EARNINGS", "PROFILE"]).default("HOME"),
  priority: z.number().int().min(0).default(0),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  promoCodeId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const guard = requireAdmin(session);
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const promotion = await prisma.promotion.create({
    data: {
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      createdById: session!.user!.id,
    },
  });

  return NextResponse.json({ promotion }, { status: 201 });
}
