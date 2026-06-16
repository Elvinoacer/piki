import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../helpers";
import { surgePricingService } from "@/lib/pricing/instance";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const updated = await surgePricingService.setGlobalConfig(body);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
