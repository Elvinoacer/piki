// src/models/types.ts
// Core domain types for the Pricing & Fare Engine (PRD 3.4)

export type VehicleType = 'bodaboda' | 'tuktuk' | 'standard' | 'xl' | 'comfort';

export interface ZonePricingConfig {
  id: string;
  countyCode: string; // e.g. "047" (Nairobi), "043" (Mombasa)
  zoneName: string;
  vehicleType: VehicleType;
  baseFare: number; // KES
  perKmRate: number; // KES per km
  perMinuteRate: number; // KES per minute
  minimumFare: number; // KES - floor applied after all calculations
  bookingFee: number; // KES - fixed platform fee, applied regardless of distance
  currency: string; // ISO 4217, default "KES"
  isActive: boolean;
  effectiveFrom: string; // ISO timestamp
  effectiveTo?: string | null;
}

export type SurgeTriggerType = 'time_window' | 'weather' | 'demand_ratio' | 'manual';

export interface SurgeRule {
  id: string;
  zoneId: string;
  triggerType: SurgeTriggerType;
  multiplier: number; // e.g. 1.5 = 50% increase. Must be >= 1.0 and <= maxAllowedMultiplier
  // time_window fields
  daysOfWeek?: number[]; // 0=Sunday .. 6=Saturday
  startTime?: string; // "HH:mm" 24hr local zone time
  endTime?: string; // "HH:mm"
  // weather fields
  weatherCondition?: 'heavy_rain' | 'storm' | 'flooding';
  // demand_ratio fields
  demandThreshold?: number; // riders-waiting / drivers-available ratio that triggers this rule
  // common
  isActive: boolean;
  priority: number; // higher priority rules evaluated first when multiple match
  createdBy?: string; // admin user id, for audit
  createdAt: string;
}

export interface SurgeConfigGlobal {
  maxAllowedMultiplier: number; // platform-wide ceiling, e.g. 3.0
  enabled: boolean;
}

export interface RoutePolyline {
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
  // raw provider response retained for audit/debugging
  provider: 'google' | 'mapbox';
  rawResponseId?: string;
}

export interface FareBreakdown {
  baseFare: number;
  distanceFare: number; // perKmRate * distanceKm
  timeFare: number; // perMinuteRate * durationMinutes
  bookingFee: number;
  surgeMultiplier: number;
  surgeAmount: number; // additive surge contribution (subtotal * (multiplier - 1))
  subtotalBeforeSurge: number;
  subtotalAfterSurge: number;
  promoDiscount: number;
  referralCreditApplied: number;
  total: number;
  currency: string;
  minimumFareApplied: boolean;
}

export interface FareEstimateRequest {
  riderId: string;
  vehicleType: VehicleType;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  promoCode?: string;
  useReferralCredits?: boolean;
  countyCode?: string; // optional override; otherwise derived from pickup geocode
  requestedAtIso?: string; // for testing/backdating surge windows; defaults to now
}

export interface FareEstimateResponse {
  estimateId: string;
  zoneId: string;
  vehicleType: VehicleType;
  distanceKm: number;
  durationMinutes: number;
  breakdown: FareBreakdown;
  negotiable: boolean;
  negotiationBounds?: NegotiationBounds;
  expiresAt: string; // ISO - estimate validity window
  route: {
    encodedPolyline: string;
    provider: 'google' | 'mapbox';
  };
}

export interface NegotiationBounds {
  minFare: number; // estimate.total * (1 - maxDiscountPct)
  maxFare: number; // estimate.total * (1 + maxSurchargePct)
  maxDiscountPct: number;
  maxSurchargePct: number;
}

export type CounterOfferActor = 'rider' | 'driver';
export type CounterOfferStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'countered';

export interface FareNegotiation {
  id: string;
  estimateId: string;
  tripId?: string;
  rounds: NegotiationRound[];
  status: CounterOfferStatus;
  finalFare?: number;
  createdAt: string;
  updatedAt: string;
}

export interface NegotiationRound {
  roundNumber: number;
  actor: CounterOfferActor;
  proposedFare: number;
  status: CounterOfferStatus;
  createdAt: string;
}

export type PromoCodeType = 'percentage' | 'fixed_amount' | 'free_booking_fee';

export interface PromoCode {
  code: string;
  type: PromoCodeType;
  value: number; // percentage (0-100) or fixed KES amount depending on type
  maxDiscountAmount?: number; // cap for percentage-type discounts
  minFareThreshold?: number; // promo only applies if subtotal >= this
  countyRestrictions?: string[]; // empty/undefined = all counties
  vehicleTypeRestrictions?: VehicleType[];
  usageLimitPerUser?: number;
  totalUsageLimit?: number;
  currentUsageCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

export interface ReferralCreditBalance {
  riderId: string;
  balance: number; // KES
  currency: string;
}

export type CancellationActor = 'rider' | 'driver' | 'system';

export interface CancellationFeeRule {
  id: string;
  vehicleType: VehicleType;
  gracePeriodSeconds: number; // free cancellation window after booking confirmed
  driverEnRouteFee: number; // flat KES fee if cancelled after driver en route, before grace expires it's free
  driverArrivedFee: number; // higher flat fee once driver has arrived at pickup
  riderNoShowFee: number;
  waiveFeeIfDriverDelayedSeconds?: number; // if driver took longer than X seconds to arrive, waive fee
  isActive: boolean;
}

export interface CancellationFeeCalculationInput {
  vehicleType: VehicleType;
  bookingConfirmedAt: string; // ISO
  cancelledAt: string; // ISO
  cancelledBy: CancellationActor;
  driverEnRouteAt?: string | null;
  driverArrivedAt?: string | null;
}

export interface CancellationFeeResult {
  feeApplicable: boolean;
  feeAmount: number;
  currency: string;
  reason: string;
}

export class FareEngineError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
    this.name = 'FareEngineError';
  }
}
