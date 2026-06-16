// src/app/api/referral/validate-promo/route.ts
// POST — validate a promo code and return the computed discount
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { validatePromoCode } from "@/lib/referral/referral.service";
import { z } from "zod";

const schema = z.object({
  code: z.string().min(1),
  fareAmount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await validatePromoCode(
    parsed.data.code,
    session.user.id,
    parsed.data.fareAmount
  );

  if (!result.valid) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 422 });
  }

  return NextResponse.json({
    valid: true,
    discount: result.discount,
    promoCode: {
      code: result.promoCode!.code,
      discountType: result.promoCode!.discountType,
      discountValue: Number(result.promoCode!.discountValue),
    },
  });
}
