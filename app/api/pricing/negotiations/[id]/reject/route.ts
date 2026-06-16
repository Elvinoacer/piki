import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../../helpers";
import { negotiationService } from "@/lib/pricing/instance";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const negotiation = await negotiationService.rejectOffer(params.id);
    return NextResponse.json(negotiation, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
