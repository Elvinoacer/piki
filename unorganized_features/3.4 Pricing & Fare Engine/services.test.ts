// src/__tests__/services.test.ts

import { SurgePricingService, InMemorySurgeRepository } from '../services/surgePricing.service';
import { CancellationFeeService, InMemoryCancellationFeeRepository } from '../services/cancellationFee.service';
import { NegotiationService, InMemoryNegotiationRepository } from '../services/negotiation.service';
import { ZonePricingService, InMemoryZonePricingRepository } from '../services/zonePricing.service';
import { FareEngineError, NegotiationBounds } from '../models/types';

describe('SurgePricingService', () => {
  test('evening peak window matches on weekday between 17:00-20:00 UTC', async () => {
    const repo = new InMemorySurgeRepository();
    const service = new SurgePricingService(repo);

    const result = await service.getEffectiveMultiplier('zp_nairobi_bodaboda', '2024-01-08T18:00:00.000Z'); // Monday 18:00
    expect(result.multiplier).toBe(1.4);
    expect(result.appliedRules[0].ruleId).toBe('surge_nairobi_evening_peak');
  });

  test('no rules match outside peak windows on a weekend with no other signals', async () => {
    const repo = new InMemorySurgeRepository();
    const service = new SurgePricingService(repo);

    const result = await service.getEffectiveMultiplier('zp_nairobi_bodaboda', '2024-01-06T12:00:00.000Z'); // Saturday noon
    expect(result.multiplier).toBe(1.0);
    expect(result.appliedRules).toHaveLength(0);
  });

  test('upsertRule rejects multiplier below 1.0', async () => {
    const repo = new InMemorySurgeRepository();
    const service = new SurgePricingService(repo);

    await expect(
      service.upsertRule({
        id: 'bad_rule',
        zoneId: 'zp_nairobi_bodaboda',
        triggerType: 'manual',
        multiplier: 0.5,
        isActive: true,
        priority: 1,
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_SURGE_MULTIPLIER' });
  });

  test('upsertRule rejects multiplier above global cap', async () => {
    const repo = new InMemorySurgeRepository();
    const service = new SurgePricingService(repo);

    await expect(
      service.upsertRule({
        id: 'too_high',
        zoneId: 'zp_nairobi_bodaboda',
        triggerType: 'manual',
        multiplier: 10,
        isActive: true,
        priority: 1,
        createdAt: new Date().toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'SURGE_EXCEEDS_CAP' });
  });
});

describe('CancellationFeeService', () => {
  function service() {
    return new CancellationFeeService(new InMemoryCancellationFeeRepository());
  }

  test('no fee within grace period', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:00:30.000Z', // 30s, within 60s grace
      cancelledBy: 'rider',
    });
    expect(result.feeApplicable).toBe(false);
    expect(result.feeAmount).toBe(0);
  });

  test('fee applies after grace period when driver is en route', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:02:00.000Z', // 2 min, past 60s grace
      cancelledBy: 'rider',
      driverEnRouteAt: '2024-01-01T10:00:45.000Z',
    });
    expect(result.feeApplicable).toBe(true);
    expect(result.feeAmount).toBe(30); // driverEnRouteFee for bodaboda
  });

  test('fee waived if driver was en route too long before cancellation', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:15:00.000Z', // 15 min total
      cancelledBy: 'rider',
      driverEnRouteAt: '2024-01-01T10:00:30.000Z', // driver en route for ~14.5 min > waive threshold 10min
    });
    expect(result.feeApplicable).toBe(false);
    expect(result.reason).toMatch(/waived/i);
  });

  test('rider no-show fee applies when cancelled after driver arrived', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:05:00.000Z',
      cancelledBy: 'rider',
      driverEnRouteAt: '2024-01-01T10:01:00.000Z',
      driverArrivedAt: '2024-01-01T10:03:00.000Z',
    });
    expect(result.feeApplicable).toBe(true);
    expect(result.feeAmount).toBe(50); // riderNoShowFee
  });

  test('driver-initiated cancellation never charges rider, even past grace period', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:10:00.000Z',
      cancelledBy: 'driver',
      driverEnRouteAt: '2024-01-01T10:01:00.000Z',
    });
    expect(result.feeApplicable).toBe(false);
  });

  test('past grace period but driver never dispatched -> no fee', async () => {
    const svc = service();
    const result = await svc.calculate({
      vehicleType: 'bodaboda',
      bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
      cancelledAt: '2024-01-01T10:05:00.000Z',
      cancelledBy: 'rider',
    });
    expect(result.feeApplicable).toBe(false);
  });

  test('throws on cancelledAt before bookingConfirmedAt', async () => {
    const svc = service();
    await expect(
      svc.calculate({
        vehicleType: 'bodaboda',
        bookingConfirmedAt: '2024-01-01T10:00:00.000Z',
        cancelledAt: '2024-01-01T09:59:00.000Z',
        cancelledBy: 'rider',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CANCELLATION_TIMESTAMPS' });
  });
});

describe('NegotiationService', () => {
  const bounds: NegotiationBounds = {
    minFare: 85,
    maxFare: 120,
    maxDiscountPct: 0.15,
    maxSurchargePct: 0.2,
  };

  function service() {
    return new NegotiationService(new InMemoryNegotiationRepository());
  }

  test('rider starts negotiation within bounds', async () => {
    const svc = service();
    const negotiation = await svc.startNegotiation('est_1', 100, bounds, 90);
    expect(negotiation.status).toBe('pending');
    expect(negotiation.rounds).toHaveLength(1);
    expect(negotiation.rounds[0].actor).toBe('rider');
    expect(negotiation.rounds[0].proposedFare).toBe(90);
  });

  test('rejects rider offer below minFare bound', async () => {
    const svc = service();
    await expect(svc.startNegotiation('est_1', 100, bounds, 50)).rejects.toMatchObject({
      code: 'NEGOTIATION_OUT_OF_BOUNDS',
    });
  });

  test('driver accepts rider offer -> status accepted with finalFare set', async () => {
    const svc = service();
    const negotiation = await svc.startNegotiation('est_1', 100, bounds, 90);
    const accepted = await svc.acceptOffer(negotiation.id);
    expect(accepted.status).toBe('accepted');
    expect(accepted.finalFare).toBe(90);
  });

  test('driver counters, then rider accepts via driver-side acceptOffer flow', async () => {
    const svc = service();
    const negotiation = await svc.startNegotiation('est_1', 100, bounds, 90);

    const countered = await svc.counterOffer(negotiation.id, 'driver', 110, bounds);
    expect(countered.rounds).toHaveLength(2);
    expect(countered.rounds[1].actor).toBe('driver');
    expect(countered.rounds[1].proposedFare).toBe(110);
    expect(countered.rounds[0].status).toBe('countered');

    const accepted = await svc.acceptOffer(countered.id);
    expect(accepted.status).toBe('accepted');
    expect(accepted.finalFare).toBe(110);
  });

  test('same actor cannot counter twice in a row', async () => {
    const svc = service();
    const negotiation = await svc.startNegotiation('est_1', 100, bounds, 90);

    await expect(svc.counterOffer(negotiation.id, 'rider', 95, bounds)).rejects.toMatchObject({
      code: 'NEGOTIATION_WRONG_TURN',
    });
  });

  test('rejecting a pending offer sets status to rejected', async () => {
    const svc = service();
    const negotiation = await svc.startNegotiation('est_1', 100, bounds, 90);
    const rejected = await svc.rejectOffer(negotiation.id);
    expect(rejected.status).toBe('rejected');
  });

  test('enforces max rounds cap', async () => {
    const svc = service();
    let negotiation = await svc.startNegotiation('est_1', 100, bounds, 90); // round 1, rider
    negotiation = await svc.counterOffer(negotiation.id, 'driver', 110, bounds); // round 2
    negotiation = await svc.counterOffer(negotiation.id, 'rider', 95, bounds); // round 3
    negotiation = await svc.counterOffer(negotiation.id, 'driver', 105, bounds); // round 4 = MAX_ROUNDS

    await expect(svc.counterOffer(negotiation.id, 'rider', 100, bounds)).rejects.toMatchObject({
      code: 'NEGOTIATION_MAX_ROUNDS_REACHED',
    });
  });

  test('acting on a non-existent negotiation throws NEGOTIATION_NOT_FOUND', async () => {
    const svc = service();
    await expect(svc.acceptOffer('neg_does_not_exist')).rejects.toMatchObject({
      code: 'NEGOTIATION_NOT_FOUND',
    });
  });
});

describe('ZonePricingService', () => {
  test('returns seeded Nairobi bodaboda config', async () => {
    const service = new ZonePricingService(new InMemoryZonePricingRepository());
    const config = await service.getActiveConfig('047', 'bodaboda', '2024-06-01T00:00:00.000Z');
    expect(config.id).toBe('zp_nairobi_bodaboda');
    expect(config.baseFare).toBe(50);
  });

  test('throws when no config exists for county/vehicle combo', async () => {
    const service = new ZonePricingService(new InMemoryZonePricingRepository());
    await expect(service.getActiveConfig('999', 'xl', '2024-06-01T00:00:00.000Z')).rejects.toMatchObject({
      code: 'ZONE_PRICING_NOT_FOUND',
    });
  });

  test('upsertConfig validates non-negative rates', async () => {
    const service = new ZonePricingService(new InMemoryZonePricingRepository());
    await expect(
      service.upsertConfig({
        id: 'bad',
        countyCode: '047',
        zoneName: 'Bad Zone',
        vehicleType: 'standard',
        baseFare: -5,
        perKmRate: 10,
        perMinuteRate: 1,
        minimumFare: 50,
        bookingFee: 5,
        currency: 'KES',
        isActive: true,
        effectiveFrom: '2024-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(FareEngineError);
  });

  test('a newer effective config supersedes an older overlapping one', async () => {
    const repo = new InMemoryZonePricingRepository();
    const service = new ZonePricingService(repo);

    await service.upsertConfig({
      id: 'zp_nairobi_bodaboda_v2',
      countyCode: '047',
      zoneName: 'Nairobi Metro',
      vehicleType: 'bodaboda',
      baseFare: 60, // price increase
      perKmRate: 20,
      perMinuteRate: 2.5,
      minimumFare: 110,
      bookingFee: 10,
      currency: 'KES',
      isActive: true,
      effectiveFrom: '2025-01-01T00:00:00.000Z',
    });

    const before = await service.getActiveConfig('047', 'bodaboda', '2024-06-01T00:00:00.000Z');
    expect(before.baseFare).toBe(50);

    const after = await service.getActiveConfig('047', 'bodaboda', '2025-06-01T00:00:00.000Z');
    expect(after.baseFare).toBe(60);
  });
});
