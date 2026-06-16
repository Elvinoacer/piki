import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../../helpers";
import { surgePricingService } from "@/lib/pricing/instance";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const rule = { ...body, id: params.id };
    const updated = await surgePricingService.upsertRule(rule);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
