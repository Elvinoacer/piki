import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../../helpers";
import { negotiationService, estimateCache } from "@/lib/pricing/instance";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { actor, proposedFare, estimateId } = await req.json();
    if (!actor || typeof proposedFare !== 'number' || !estimateId) {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: 'actor, proposedFare and estimateId are required' },
      }, { status: 400 });
    }
    const cached = estimateCache.get(estimateId);
    if (!cached?.negotiationBounds) {
      return NextResponse.json({
        error: { code: 'ESTIMATE_NOT_FOUND', message: `No negotiable estimate found for ${estimateId}` },
      }, { status: 404 });
    }

    const negotiation = await negotiationService.counterOffer(
      params.id,
      actor,
      proposedFare,
      cached.negotiationBounds,
    );
    return NextResponse.json(negotiation, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
