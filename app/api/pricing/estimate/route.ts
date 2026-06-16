import { NextRequest, NextResponse } from "next/server";
import { validateEstimateRequest, handleError } from "../helpers";
import { fareEngineService, estimateCache } from "@/lib/pricing/instance";
import type { FareEstimateRequest } from "@/lib/pricing/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validationError = validateEstimateRequest(body);
    if (validationError) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: validationError } }, { status: 400 });
    }

    const fareReq: FareEstimateRequest = {
      riderId: body.riderId,
      vehicleType: body.vehicleType,
      pickup: body.pickup,
      dropoff: body.dropoff,
      promoCode: body.promoCode,
      useReferralCredits: body.useReferralCredits,
      countyCode: body.countyCode,
      requestedAtIso: body.requestedAtIso,
    };

    const estimate = await fareEngineService.generateEstimate(fareReq);

    estimateCache.set(estimate.estimateId, {
      total: estimate.breakdown.total,
      negotiationBounds: estimate.negotiationBounds,
    });

    return NextResponse.json(estimate, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
