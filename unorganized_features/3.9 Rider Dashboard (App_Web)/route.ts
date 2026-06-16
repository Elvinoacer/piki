// app/api/rider/dashboard/route.ts
// GET /api/rider/dashboard — full dashboard data snapshot (used by SSR page)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRiderDashboardData } from "@/lib/api/riderDashboard";

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getRiderDashboardData(session.user.riderId as string);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/rider/dashboard] error:", err);
    return NextResponse.json(
      { message: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
