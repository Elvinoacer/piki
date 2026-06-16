// src/__tests__/fareEngine.test.ts

import { FareEngineService, StaticCountyGeocodingService, defaultFareEngineConfig } from '../services/fareEngine.service';
import { InMemoryZonePricingRepository, ZonePricingService } from '../services/zonePricing.service';
import { InMemorySurgeRepository, SurgePricingService } from '../services/surgePricing.service';
import { InMemoryPromoRepository, InMemoryReferralCreditRepository, PromoService } from '../services/promo.service';
import { RoutingProvider, LatLng } from '../services/routing.service';
import { FareEngineError, RoutePolyline } from '../models/types';

class FixedRoutingProvider implements RoutingProvider {
  constructor(private route: RoutePolyline) {}
  async getRoute(_origin: LatLng, _destination: LatLng): Promise<RoutePolyline> {
    return this.route;
  }
}

const NAIROBI_PICKUP: LatLng = { lat: -1.286389, lng: 36.817223 }; // Nairobi CBD
const NAIROBI_DROPOFF: LatLng = { lat: -1.3, lng: 36.78 };

function buildEngine(routeOverride?: Partial<RoutePolyline>, demandRatio = 1.0, weather: string | null = null) {
  const zoneRepo = new InMemoryZonePricingRepository();
  const surgeRepo = new InMemorySurgeRepository();
  surgeRepo.demandRatios.set('zp_nairobi_bodaboda', demandRatio);
  surgeRepo.weatherConditions.set('zp_nairobi_bodaboda', weather);

  const promoRepo = new InMemoryPromoRepository();
  const referralRepo = new InMemoryReferralCreditRepository();

  const zonePricing = new ZonePricingService(zoneRepo);
  const surgePricing = new SurgePricingService(surgeRepo);
  const promo = new PromoService(promoRepo, referralRepo);

  const route: RoutePolyline = {
    encodedPolyline: 'mockPolyline',
    distanceMeters: 5000, // 5km
    durationSeconds: 600, // 10 minutes
    provider: 'google',
    ...routeOverride,
  };

  const engine = new FareEngineService(
    zonePricing,
    surgePricing,
    promo,
    new FixedRoutingProvider(route),
    new StaticCountyGeocodingService(),
    defaultFareEngineConfig,
  );

  return { engine, referralRepo, promoRepo, zonePricing, surgePricing };
}

describe('FareEngineService - basic fare calculation', () => {
  test('computes base + distance + time fare with no surge/promo', async () => {
    const { engine } = buildEngine();

    // Use a Sunday off-peak, no-rain time to avoid surge rules (2024-01-07 is a Sunday, 12:00 UTC)
    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    // Nairobi bodaboda config: baseFare=50, perKm=18, perMin=2, bookingFee=10
    // distance=5km -> distanceFare=90; duration=10min -> timeFare=20
    expect(estimate.breakdown.baseFare).toBe(50);
    expect(estimate.breakdown.distanceFare).toBe(90);
    expect(estimate.breakdown.timeFare).toBe(20);
    expect(estimate.breakdown.subtotalBeforeSurge).toBe(160);
    expect(estimate.breakdown.surgeMultiplier).toBe(1);
    expect(estimate.breakdown.bookingFee).toBe(10);
    // total = 160 (subtotal) + 10 (booking fee) = 170, above minimumFare(100)
    expect(estimate.breakdown.total).toBe(170);
    expect(estimate.breakdown.minimumFareApplied).toBe(false);
    expect(estimate.distanceKm).toBe(5);
    expect(estimate.durationMinutes).toBe(10);
    expect(estimate.route.provider).toBe('google');
  });

  test('applies minimum fare floor for very short trips', async () => {
    const { engine } = buildEngine({ distanceMeters: 200, durationSeconds: 60 }); // 0.2km, 1min

    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    // baseFare(50) + distanceFare(0.2*18=3.6) + timeFare(1*2=2) = 55.6 + bookingFee(10) = 65.6
    // minimumFare = 100, so floor applies
    expect(estimate.breakdown.subtotalBeforeSurge).toBeCloseTo(55.6, 2);
    expect(estimate.breakdown.total).toBe(100);
    expect(estimate.breakdown.minimumFareApplied).toBe(true);
  });

  test('returns negotiation bounds for bodaboda but not for standard', async () => {
    const { engine } = buildEngine();

    const bodaEstimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });
    expect(bodaEstimate.negotiable).toBe(true);
    expect(bodaEstimate.negotiationBounds).toBeDefined();
    expect(bodaEstimate.negotiationBounds!.minFare).toBeCloseTo(170 * 0.85, 2);
    expect(bodaEstimate.negotiationBounds!.maxFare).toBeCloseTo(170 * 1.2, 2);

    const standardEstimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'standard',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });
    expect(standardEstimate.negotiable).toBe(false);
    expect(standardEstimate.negotiationBounds).toBeUndefined();
  });
});

describe('FareEngineService - surge pricing', () => {
  test('applies morning peak time-window surge multiplier', async () => {
    const { engine } = buildEngine();

    // Monday 2024-01-08 07:00 UTC falls within 06:30-09:00 weekday peak (multiplier 1.3)
    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-08T07:00:00.000Z',
    });

    expect(estimate.breakdown.surgeMultiplier).toBe(1.3);
    // subtotalBeforeSurge = 160, surgeAmount = 160*0.3=48, subtotalAfterSurge=208
    expect(estimate.breakdown.surgeAmount).toBeCloseTo(48, 2);
    expect(estimate.breakdown.subtotalAfterSurge).toBeCloseTo(208, 2);
    expect(estimate.breakdown.total).toBeCloseTo(218, 2); // +bookingFee(10)
  });

  test('applies weather-based surge when heavy rain is active', async () => {
    const { engine, surgePricing } = buildEngine(undefined, 1.0, 'heavy_rain');

    // Use an off-peak time so only the weather rule matches
    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-07T12:00:00.000Z', // Sunday, no time-window rules active
    });

    expect(estimate.breakdown.surgeMultiplier).toBe(1.5);

    const evaluation = await surgePricing.getEffectiveMultiplier('zp_nairobi_bodaboda', '2024-01-07T12:00:00.000Z');
    expect(evaluation.appliedRules[0].triggerType).toBe('weather');
  });

  test('demand-ratio surge wins over time-window surge by priority', async () => {
    const { engine } = buildEngine(undefined, 5.0, null); // demand ratio 5.0 >= threshold 3.0

    // Monday morning peak AND high demand both match; demand rule has priority 30 > 10
    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-08T07:00:00.000Z',
    });

    expect(estimate.breakdown.surgeMultiplier).toBe(1.6);
  });

  test('surge multiplier is clamped to global maxAllowedMultiplier', async () => {
    const { engine, surgePricing } = buildEngine(undefined, 5.0, 'heavy_rain');
    await surgePricing.setGlobalConfig({ enabled: true, maxAllowedMultiplier: 1.2 });

    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-08T07:00:00.000Z',
    });

    expect(estimate.breakdown.surgeMultiplier).toBe(1.2);
  });

  test('surge disabled globally results in 1.0 multiplier even with matching rules', async () => {
    const { engine, surgePricing } = buildEngine(undefined, 5.0, 'heavy_rain');
    await surgePricing.setGlobalConfig({ enabled: false, maxAllowedMultiplier: 3.0 });

    const estimate = await engine.generateEstimate({
      riderId: 'rider_1',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      requestedAtIso: '2024-01-08T07:00:00.000Z',
    });

    expect(estimate.breakdown.surgeMultiplier).toBe(1.0);
  });
});

describe('FareEngineService - promo codes & referral credits', () => {
  test('applies a percentage promo with max discount cap', async () => {
    const { engine } = buildEngine();

    // subtotalAfterSurge = 160 (no surge); WELCOME50 = 50% off, capped at 100
    // 50% of 160 = 80, which is under the 100 cap, so discount = 80
    const estimate = await engine.generateEstimate({
      riderId: 'rider_new',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      promoCode: 'WELCOME50',
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    expect(estimate.breakdown.promoDiscount).toBe(80);
    // total = subtotalAfterSurge(160) + bookingFee(10) - promoDiscount(80) = 90
    // but minimumFare=100, so floor applies
    expect(estimate.breakdown.total).toBe(100);
    expect(estimate.breakdown.minimumFareApplied).toBe(true);
  });

  test('rejects promo when user usage limit reached', async () => {
    const { engine, promoRepo } = buildEngine();

    await promoRepo.recordUsage('WELCOME50', 'rider_repeat', 'trip_1');

    await expect(
      engine.generateEstimate({
        riderId: 'rider_repeat',
        vehicleType: 'bodaboda',
        pickup: NAIROBI_PICKUP,
        dropoff: NAIROBI_DROPOFF,
        promoCode: 'WELCOME50',
        requestedAtIso: '2024-01-07T12:00:00.000Z',
      }),
    ).rejects.toThrow(FareEngineError);
  });

  test('fixed-amount promo restricted to bodaboda + Nairobi applies correctly', async () => {
    const { engine } = buildEngine();

    // subtotalAfterSurge=160 >= minFareThreshold(100); BODA20 = 20 off
    const estimate = await engine.generateEstimate({
      riderId: 'rider_2',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      promoCode: 'BODA20',
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    expect(estimate.breakdown.promoDiscount).toBe(20);
    // total = 160 + 10 - 20 = 150
    expect(estimate.breakdown.total).toBe(150);
  });

  test('free_booking_fee promo waives the booking fee', async () => {
    const { engine } = buildEngine();

    const estimate = await engine.generateEstimate({
      riderId: 'rider_3',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      promoCode: 'NOBOOKINGFEE',
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    expect(estimate.breakdown.bookingFee).toBe(0);
    expect(estimate.breakdown.promoDiscount).toBe(0);
    // total = 160 + 0 - 0 = 160
    expect(estimate.breakdown.total).toBe(160);
  });

  test('applies referral credits up to the remaining balance', async () => {
    const { engine, referralRepo } = buildEngine();
    await referralRepo.creditBalance('rider_4', 50);

    // subtotal=160 + bookingFee 10 = 170; referral credit of 50 applied -> total = 120
    const estimate = await engine.generateEstimate({
      riderId: 'rider_4',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      useReferralCredits: true,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    expect(estimate.breakdown.referralCreditApplied).toBe(50);
    expect(estimate.breakdown.total).toBe(120);
  });

  test('referral credit application respects the minimum fare floor', async () => {
    const { engine, referralRepo } = buildEngine();
    // Huge balance, but minimum fare (100) must still apply
    await referralRepo.creditBalance('rider_5', 1000);

    const estimate = await engine.generateEstimate({
      riderId: 'rider_5',
      vehicleType: 'bodaboda',
      pickup: NAIROBI_PICKUP,
      dropoff: NAIROBI_DROPOFF,
      useReferralCredits: true,
      requestedAtIso: '2024-01-07T12:00:00.000Z',
    });

    // afterPromo = 170; capped credit = 170-100=70
    expect(estimate.breakdown.referralCreditApplied).toBe(70);
    expect(estimate.breakdown.total).toBe(100);
    expect(estimate.breakdown.minimumFareApplied).toBe(true);
  });

  test('throws PROMO_NOT_FOUND for unknown promo code', async () => {
    const { engine } = buildEngine();

    await expect(
      engine.generateEstimate({
        riderId: 'rider_6',
        vehicleType: 'bodaboda',
        pickup: NAIROBI_PICKUP,
        dropoff: NAIROBI_DROPOFF,
        promoCode: 'DOESNOTEXIST',
        requestedAtIso: '2024-01-07T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'PROMO_NOT_FOUND' });
  });
});

describe('FareEngineService - error handling', () => {
  test('throws ZONE_PRICING_NOT_FOUND for unsupported county/vehicle combo', async () => {
    const { engine } = buildEngine();

    await expect(
      engine.generateEstimate({
        riderId: 'rider_1',
        vehicleType: 'comfort', // no seed config for comfort
        pickup: NAIROBI_PICKUP,
        dropoff: NAIROBI_DROPOFF,
        requestedAtIso: '2024-01-07T12:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'ZONE_PRICING_NOT_FOUND' });
  });
});
