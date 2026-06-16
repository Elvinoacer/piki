// src/app/api/referral/my-code/route.ts
// GET  — returns or creates the calling user's referral code
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateReferralCode } from "@/lib/referral/referral.service";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const role = session.user.role as "CLIENT" | "RIDER";
  if (role !== "CLIENT" && role !== "RIDER") {
    return NextResponse.json({ error: "Admins do not have referral codes" }, { status: 403 });
  }

  const code = await getOrCreateReferralCode(session.user.id, role);
  return NextResponse.json({ code });
}
