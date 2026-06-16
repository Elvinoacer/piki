// app/(app)/history/route.ts
// Feature 3.14 — Search, History & Receipts
// GET  /history?search=&dateFrom=&dateTo=&type=&status=&page=&pageSize=

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTripHistory } from "@/lib/trip-history";
import type { TripHistoryFilters, TripType, TripStatus } from "@/types/history";

const VALID_TYPES = ["ALL", "RIDE", "PARCEL", "FOOD", "ERRAND"] as const;
const VALID_STATUSES = [
  "ALL",
  "REQUESTED",
  "ACCEPTED",
  "ARRIVING",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  const rawType = (searchParams.get("type") ?? "ALL").toUpperCase();
  const rawStatus = (searchParams.get("status") ?? "ALL").toUpperCase();
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const rawPageSize = parseInt(searchParams.get("pageSize") ?? "10", 10);

  // Validate enums
  if (!VALID_TYPES.includes(rawType as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid type filter" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(rawStatus as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const filters: TripHistoryFilters = {
    search: searchParams.get("search") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? null,
    dateTo: searchParams.get("dateTo") ?? null,
    type: rawType as TripType | "ALL",
    status: rawStatus as TripStatus | "ALL",
    page: Math.max(1, rawPage),
    pageSize: Math.min(50, Math.max(1, rawPageSize)),
  };

  const role = session.user.role === "RIDER" ? "RIDER" : "CLIENT";

  try {
    const result = await getTripHistory(session.user.id, role, filters);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /history] Error:", err);
    return NextResponse.json({ error: "Failed to fetch trip history" }, { status: 500 });
  }
}
