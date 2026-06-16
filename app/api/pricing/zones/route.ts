import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../helpers";
import { zonePricingService } from "@/lib/pricing/instance";

export async function GET(_req: NextRequest) {
  try {
    const zones = await zonePricingService.list();
    return NextResponse.json({ zones }, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
