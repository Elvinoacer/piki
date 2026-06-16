// src/app/api/loyalty/route.ts
// GET — loyalty account + recent transaction history for the calling user
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const account = await prisma.loyaltyAccount.findUnique({
    where: { userId: session.user.id },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!account) {
    return NextResponse.json({ account: null, history: [] });
  }

  const { transactions, ...accountData } = account;
  return NextResponse.json({ account: accountData, history: transactions });
}
