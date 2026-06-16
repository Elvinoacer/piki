// src/services/fareEngine.service.ts
// Core orchestrator: produces an upfront fare estimate (3.4 bullet 3) by combining
// base+per-km+per-minute pricing (bullet 1), surge (bullet 2), route data (bullet 5),
// and promo/referral discounts (bullet 7).

import {
  FareBreakdown,
  FareEngineError,
  FareEstimateRequest,
  FareEstimateResponse,
  NegotiationBounds,
} from '../models/types';
import { ZonePricingService } from './zonePricing.service';
import { SurgePricingService } from './surgePricing.service';
import { PromoService } from './promo.service';
import { LatLng, RoutingProvider, metersToKm, secondsToMinutes } from './routing.service';

export interface GeocodingService {
  /** Resolves a lat/lng to a Kenyan county code (e.g. "047" for Nairobi). */
  countyCodeFor(point: LatLng): Promise<string>;
}

/**
 * Simple bounding-box geocoder for the seeded counties. Replace with a real
 * reverse-geocoding service (e.g. Google Geocoding API) in production.
 */
export class StaticCountyGeocodingService implements GeocodingService {
  // Rough bounding boxes - good enough for routing requests to the correct
  // zone pricing config without an external API call on the hot path.
  private boxes: { countyCode: string; minLat: number; maxLat: number; minLng: number; maxLng: number }[] = [
    { countyCode: '047', minLat: -1.444, maxLat: -1.163, minLng: 36.65, maxLng: 37.1 }, // Nairobi
    { countyCode: '043', minLat: -4.13, maxLat: -3.95, minLng: 39.55, maxLng: 39.75 }, // Mombasa
  ];

  async countyCodeFor(point: LatLng): Promise<string> {
    for (const box of this.boxes) {
      if (
        point.lat >= box.minLat &&
        point.lat <= box.maxLat &&
        point.lng >= box.minLng &&
        point.lng <= box.maxLng
      ) {
        return box.countyCode;
      }
    }
    // default to Nairobi if outside known bounding boxes
    return '047';
  }
}

export interface FareEngineConfig {
  estimateValidityMinutes: number; // how long a fare estimate stays valid
  negotiationEnabledByDefault: boolean;
  negotiationMaxDiscountPct: number; // e.g. 0.15 = rider can offer up to 15% below estimate
  negotiationMaxSurchargePct: number; // e.g. 0.20 = driver can counter up to 20% above
  vehicleTypesWithNegotiation: string[]; // e.g. ['bodaboda', 'tuktuk'] per "bodaboda culture" note
}

export const defaultFareEngineConfig: FareEngineConfig = {
  estimateValidityMinutes: 5,
  negotiationEnabledByDefault: true,
  negotiationMaxDiscountPct: 0.15,
  negotiationMaxSurchargePct: 0.2,
  vehicleTypesWithNegotiation: ['bodaboda', 'tuktuk'],
};

export class FareEngineService {
  constructor(
    private zonePricing: ZonePricingService,
    private surgePricing: SurgePricingService,
    private promoService: PromoService,
    private routingProvider: RoutingProvider,
    private geocoding: GeocodingService,
    private config: FareEngineConfig = defaultFareEngineConfig,
  ) {}

  async generateEstimate(req: FareEstimateRequest): Promise<FareEstimateResponse> {
    const atIso = req.requestedAtIso ?? new Date().toISOString();
    const countyCode = req.countyCode ?? (await this.geocoding.countyCodeFor(req.pickup));

    const zoneConfig = await this.zonePricing.getActiveConfig(countyCode, req.vehicleType, atIso);
    const route = await this.routingProvider.getRoute(req.pickup, req.dropoff);

    const distanceKm = metersToKm(route.distanceMeters);
    const durationMinutes = secondsToMinutes(route.durationSeconds);

    const surgeResult = await this.surgePricing.getEffectiveMultiplier(zoneConfig.id, atIso);

    const breakdown = await this.computeBreakdown({
      distanceKm,
      durationMinutes,
      baseFare: zoneConfig.baseFare,
      perKmRate: zoneConfig.perKmRate,
      perMinuteRate: zoneConfig.perMinuteRate,
      minimumFare: zoneConfig.minimumFare,
      bookingFee: zoneConfig.bookingFee,
      currency: zoneConfig.currency,
      surgeMultiplier: surgeResult.multiplier,
      promoCode: req.promoCode,
      useReferralCredits: req.useReferralCredits,
      riderId: req.riderId,
      countyCode,
      vehicleType: req.vehicleType,
      atIso,
    });

    const negotiable = this.config.vehicleTypesWithNegotiation.includes(req.vehicleType);
    const negotiationBounds = negotiable
      ? this.computeNegotiationBounds(breakdown.total)
      : undefined;

    const expiresAt = new Date(
      Date.now() + this.config.estimateValidityMinutes * 60 * 1000,
    ).toISOString();

    return {
      estimateId: generateEstimateId(),
      zoneId: zoneConfig.id,
      vehicleType: req.vehicleType,
      distanceKm: round2(distanceKm),
      durationMinutes: round2(durationMinutes),
      breakdown,
      negotiable,
      negotiationBounds,
      expiresAt,
      route: {
        encodedPolyline: route.encodedPolyline,
        provider: route.provider,
      },
    };
  }

  /**
   * Pure calculation function - exposed separately so it can be reused for
   * re-pricing on trip completion (actual distance/time vs estimate) without
   * re-fetching routes or re-resolving zones.
   */
  async computeBreakdown(params: {
    distanceKm: number;
    durationMinutes: number;
    baseFare: number;
    perKmRate: number;
    perMinuteRate: number;
    minimumFare: number;
    bookingFee: number;
    currency: string;
    surgeMultiplier: number;
    promoCode?: string;
    useReferralCredits?: boolean;
    riderId: string;
    countyCode: string;
    vehicleType: import('../models/types').VehicleType;
    atIso: string;
  }): Promise<FareBreakdown> {
    if (params.distanceKm < 0 || params.durationMinutes < 0) {
      throw new FareEngineError('INVALID_ROUTE', 'distanceKm and durationMinutes must be >= 0');
    }

    const distanceFare = round2(params.distanceKm * params.perKmRate);
    const timeFare = round2(params.durationMinutes * params.perMinuteRate);
    const subtotalBeforeSurge = round2(params.baseFare + distanceFare + timeFare);

    const surgeAmount = round2(subtotalBeforeSurge * (params.surgeMultiplier - 1));
    const subtotalAfterSurge = round2(subtotalBeforeSurge + surgeAmount);

    let bookingFee = params.bookingFee;
    let promoDiscount = 0;

    if (params.promoCode) {
      try {
        const promoResult = await this.promoService.validateAndCompute(params.promoCode, {
          riderId: params.riderId,
          countyCode: params.countyCode,
          vehicleType: params.vehicleType,
          subtotal: subtotalAfterSurge,
          atIso: params.atIso,
        });
        promoDiscount = promoResult.promoDiscount;
        if (promoResult.bookingFeeWaived) bookingFee = 0;
      } catch (err) {
        if (err instanceof FareEngineError) {
          // Re-throw with a clearer field so controllers can decide to
          // surface "invalid promo" to the user without failing silently.
          throw err;
        }
        throw err;
      }
    }

    const afterPromo = Math.max(0, round2(subtotalAfterSurge + bookingFee - promoDiscount));

    let referralCreditApplied = 0;
    if (params.useReferralCredits) {
      referralCreditApplied = await this.promoService.previewReferralCredit(
        params.riderId,
        afterPromo,
      );
    }

    let total = round2(afterPromo - referralCreditApplied);

    let minimumFareApplied = false;
    if (total < params.minimumFare) {
      // Minimum fare floor applies to the rider-facing total, but referral
      // credits already applied should not be "wasted" beyond the floor -
      // re-cap the credit applied so total lands exactly on the minimum.
      const maxCreditGivenFloor = Math.max(0, round2(afterPromo - params.minimumFare));
      if (referralCreditApplied > maxCreditGivenFloor) {
        referralCreditApplied = maxCreditGivenFloor;
      }
      total = params.minimumFare;
      minimumFareApplied = true;
    }

    return {
      baseFare: params.baseFare,
      distanceFare,
      timeFare,
      bookingFee,
      surgeMultiplier: params.surgeMultiplier,
      surgeAmount,
      subtotalBeforeSurge,
      subtotalAfterSurge,
      promoDiscount,
      referralCreditApplied: round2(referralCreditApplied),
      total,
      currency: params.currency,
      minimumFareApplied,
    };
  }

  private computeNegotiationBounds(estimateTotal: number): NegotiationBounds {
    return {
      minFare: round2(estimateTotal * (1 - this.config.negotiationMaxDiscountPct)),
      maxFare: round2(estimateTotal * (1 + this.config.negotiationMaxSurchargePct)),
      maxDiscountPct: this.config.negotiationMaxDiscountPct,
      maxSurchargePct: this.config.negotiationMaxSurchargePct,
    };
  }
}

function generateEstimateId(): string {
  return `est_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
