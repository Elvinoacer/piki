import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../helpers";
import { negotiationService, estimateCache } from "@/lib/pricing/instance";

export async function POST(req: NextRequest) {
  try {
    const { estimateId, proposedFare } = await req.json();
    if (!estimateId || typeof proposedFare !== 'number') {
      return NextResponse.json({
        error: { code: 'VALIDATION_ERROR', message: 'estimateId and proposedFare are required' },
      }, { status: 400 });
    }

    const cached = estimateCache.get(estimateId);
    if (!cached) {
      return NextResponse.json({
        error: { code: 'ESTIMATE_NOT_FOUND', message: `No estimate found for ${estimateId} (it may have expired)` },
      }, { status: 404 });
    }
    if (!cached.negotiationBounds) {
      return NextResponse.json({
        error: { code: 'NEGOTIATION_NOT_SUPPORTED', message: 'This vehicle type does not support fare negotiation' },
      }, { status: 409 });
    }

    const negotiation = await negotiationService.startNegotiation(
      estimateId,
      cached.total,
      cached.negotiationBounds,
      proposedFare,
    );
    return NextResponse.json(negotiation, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
