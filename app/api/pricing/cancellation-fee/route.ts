import { NextRequest, NextResponse } from "next/server";
import { handleError } from "../helpers";
import { cancellationFeeService } from "@/lib/pricing/instance";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.vehicleType || !body.bookingConfirmedAt || !body.cancelledAt || !body.cancelledBy) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'vehicleType, bookingConfirmedAt, cancelledAt and cancelledBy are required',
        },
      }, { status: 400 });
    }
    const result = await cancellationFeeService.calculate(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
