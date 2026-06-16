import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../../../helpers";
import { promoService } from "@/lib/pricing/instance";
import type { VehicleType } from "@/lib/pricing/types";

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const riderId = searchParams.get('riderId');
    const countyCode = searchParams.get('countyCode');
    const vehicleType = searchParams.get('vehicleType');
    const subtotalRaw = searchParams.get('subtotal');

    if (!riderId || !countyCode || !vehicleType || subtotalRaw === null) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'riderId, countyCode, vehicleType and subtotal query params are required',
        },
      }, { status: 400 });
    }

    const subtotal = Number(subtotalRaw);
    const result = await promoService.validateAndCompute(params.code, {
      riderId,
      countyCode,
      vehicleType: vehicleType as VehicleType,
      subtotal,
      atIso: new Date().toISOString(),
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
