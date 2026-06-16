// app/api/rider/trips/route.ts
// GET /api/rider/trips?page=1&pageSize=20 — paginated trip history

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchTripHistory } from "@/lib/api/riderDashboard";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "20", 10), 50);

  const { items, hasMore } = await fetchTripHistory(
    session.user.riderId as string,
    { page, pageSize }
  );

  return NextResponse.json({ trips: items, hasMore, page });
}
