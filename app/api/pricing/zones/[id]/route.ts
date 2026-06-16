import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../helpers";
import { zonePricingService } from "@/lib/pricing/instance";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const config = { ...body, id: params.id };
    const updated = await zonePricingService.upsertConfig(config);
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
