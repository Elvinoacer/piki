// src/app/api/ratings/route.ts
// POST /api/ratings        — submit a post-trip rating
// GET  /api/ratings?tripId — fetch rating summary for a trip

import { NextRequest, NextResponse } from "next/server";
import { submitRating, getTripRatingSummary } from "@/lib/actions/ratings.actions";
import type { SubmitRatingPayload } from "@/types/ratings";

export async function POST(req: NextRequest) {
  try {
    const body: SubmitRatingPayload = await req.json();
    const result = await submitRating(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }

  const summary = await getTripRatingSummary(tripId);
  if (!summary) {
    return NextResponse.json({ error: "Not found or unauthorised" }, { status: 404 });
  }
  return NextResponse.json(summary);
}
