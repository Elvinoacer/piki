// app/api/rider/earnings/route.ts
// GET /api/rider/earnings — refreshes earnings + wallet after trip completion
// Called by the socket handler in useRiderSocket after a trip completes.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchEarningsSummary,
  fetchWalletBalance,
} from "@/lib/api/riderDashboard";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const riderId = session.user.riderId as string;
  const [earnings, wallet] = await Promise.all([
    fetchEarningsSummary(riderId),
    fetchWalletBalance(riderId),
  ]);

  return NextResponse.json({ earnings, wallet });
}
