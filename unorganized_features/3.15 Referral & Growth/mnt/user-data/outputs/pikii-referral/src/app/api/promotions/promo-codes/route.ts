// src/app/api/promotions/promo-codes/route.ts
// GET  — list promo codes (admin)
// POST — create a promo code (admin)
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

  const [codes, total] = await Promise.all([
    prisma.promoCode.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 20,
      take: 20,
    }),
    prisma.promoCode.count(),
  ]);

  return NextResponse.json({ codes, total });
}

const createSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .toUpperCase()
    .regex(/^[A-Z0-9_-]+$/, "Code must be alphanumeric"),
  description: z.string().max(200).optional(),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.number().positive(),
  minFare: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  perUserLimit: z.number().int().min(1).default(1),
  targetRole: z.enum(["ALL", "CLIENT", "RIDER"]).default("CLIENT"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
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

  const existing = await prisma.promoCode.findUnique({
    where: { code: parsed.data.code },
  });
  if (existing) {
    return NextResponse.json({ error: "Code already exists" }, { status: 409 });
  }

  const promoCode = await prisma.promoCode.create({
    data: {
      ...parsed.data,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
      createdById: session!.user!.id,
    },
  });

  return NextResponse.json({ promoCode }, { status: 201 });
}
