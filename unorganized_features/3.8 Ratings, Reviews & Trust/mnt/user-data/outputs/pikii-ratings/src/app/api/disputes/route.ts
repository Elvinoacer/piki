// src/app/api/disputes/route.ts
// POST /api/disputes — raise a dispute against a trip (or a specific rating)

import { NextRequest, NextResponse } from "next/server";
import { submitDispute } from "@/lib/actions/ratings.actions";
import type { SubmitDisputePayload } from "@/types/ratings";

export async function POST(req: NextRequest) {
  try {
    const body: SubmitDisputePayload = await req.json();
    const result = await submitDispute(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result.data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
