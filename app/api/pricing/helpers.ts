import { NextResponse } from "next/server";
import { FareEngineError, VehicleType } from "@/lib/pricing/types";

const VALID_VEHICLE_TYPES: VehicleType[] = ['bodaboda', 'tuktuk', 'standard', 'xl', 'comfort'];

export function validateEstimateRequest(body: any): string | null {
  if (!body.riderId) return 'riderId is required';
  if (!body.vehicleType || !VALID_VEHICLE_TYPES.includes(body.vehicleType)) {
    return `vehicleType must be one of: ${VALID_VEHICLE_TYPES.join(', ')}`;
  }
  if (!isLatLng(body.pickup)) return 'pickup must be { lat, lng }';
  if (!isLatLng(body.dropoff)) return 'dropoff must be { lat, lng }';
  return null;
}

export function isLatLng(v: any): boolean {
  return v && typeof v.lat === 'number' && typeof v.lng === 'number';
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof FareEngineError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
  }
  console.error('Unexpected error in pricing controller:', err);
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 });
}
