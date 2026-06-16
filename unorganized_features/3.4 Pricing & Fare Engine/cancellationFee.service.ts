// src/services/cancellationFee.service.ts
// Cancellation fee logic: grace period, then fee if cancelled after rider en route (3.4 bullet 6).

import { CancellationFeeCalculationInput, CancellationFeeResult, CancellationFeeRule, FareEngineError, VehicleType } from '../models/types';

export interface CancellationFeeRepository {
  findActiveRule(vehicleType: VehicleType): Promise<CancellationFeeRule | null>;
  upsertRule(rule: CancellationFeeRule): Promise<CancellationFeeRule>;
}

export class InMemoryCancellationFeeRepository implements CancellationFeeRepository {
  private rules = new Map<VehicleType, CancellationFeeRule>();

  constructor(seed: CancellationFeeRule[] = defaultCancellationSeed) {
    seed.forEach((r) => this.rules.set(r.vehicleType, r));
  }

  async findActiveRule(vehicleType: VehicleType): Promise<CancellationFeeRule | null> {
    const rule = this.rules.get(vehicleType);
    return rule && rule.isActive ? rule : null;
  }

  async upsertRule(rule: CancellationFeeRule): Promise<CancellationFeeRule> {
    this.rules.set(rule.vehicleType, rule);
    return rule;
  }
}

export const defaultCancellationSeed: CancellationFeeRule[] = [
  {
    id: 'cancel_bodaboda',
    vehicleType: 'bodaboda',
    gracePeriodSeconds: 60,
    driverEnRouteFee: 30,
    driverArrivedFee: 50,
    riderNoShowFee: 50,
    waiveFeeIfDriverDelayedSeconds: 600, // 10 min
    isActive: true,
  },
  {
    id: 'cancel_standard',
    vehicleType: 'standard',
    gracePeriodSeconds: 120,
    driverEnRouteFee: 100,
    driverArrivedFee: 150,
    riderNoShowFee: 150,
    waiveFeeIfDriverDelayedSeconds: 900, // 15 min
    isActive: true,
  },
];

export class CancellationFeeService {
  constructor(private repo: CancellationFeeRepository) {}

  async calculate(input: CancellationFeeCalculationInput): Promise<CancellationFeeResult> {
    const rule = await this.repo.findActiveRule(input.vehicleType);
    if (!rule) {
      return {
        feeApplicable: false,
        feeAmount: 0,
        currency: 'KES',
        reason: `No cancellation fee rule configured for vehicle type ${input.vehicleType}`,
      };
    }

    const confirmedAt = new Date(input.bookingConfirmedAt);
    const cancelledAt = new Date(input.cancelledAt);

    if (cancelledAt < confirmedAt) {
      throw new FareEngineError(
        'INVALID_CANCELLATION_TIMESTAMPS',
        'cancelledAt cannot be before bookingConfirmedAt',
      );
    }

    const elapsedSeconds = (cancelledAt.getTime() - confirmedAt.getTime()) / 1000;

    // 1. Within grace period -> always free, regardless of driver status.
    if (elapsedSeconds <= rule.gracePeriodSeconds) {
      return {
        feeApplicable: false,
        feeAmount: 0,
        currency: 'KES',
        reason: `Cancelled within grace period (${rule.gracePeriodSeconds}s)`,
      };
    }

    // 2. System-initiated cancellations (e.g. no drivers found) never charge the rider.
    if (input.cancelledBy === 'system') {
      return {
        feeApplicable: false,
        feeAmount: 0,
        currency: 'KES',
        reason: 'System-initiated cancellation - no fee charged',
      };
    }

    // 3. Driver cancellations never charge the rider.
    if (input.cancelledBy === 'driver') {
      return {
        feeApplicable: false,
        feeAmount: 0,
        currency: 'KES',
        reason: 'Driver-initiated cancellation - no fee charged to rider',
      };
    }

    // 4. Rider no-show: driver arrived and waited, rider cancelled/never showed.
    if (input.driverArrivedAt) {
      const arrivedAt = new Date(input.driverArrivedAt);
      if (cancelledAt >= arrivedAt) {
        return {
          feeApplicable: true,
          feeAmount: rule.riderNoShowFee,
          currency: 'KES',
          reason: 'Rider cancelled after driver arrived at pickup (no-show)',
        };
      }
    }

    // 5. Driver en route: check if driver took too long (waive fee if so).
    if (input.driverEnRouteAt) {
      const enRouteAt = new Date(input.driverEnRouteAt);
      if (cancelledAt >= enRouteAt) {
        if (rule.waiveFeeIfDriverDelayedSeconds !== undefined) {
          const driverElapsed = (cancelledAt.getTime() - enRouteAt.getTime()) / 1000;
          if (driverElapsed >= rule.waiveFeeIfDriverDelayedSeconds) {
            return {
              feeApplicable: false,
              feeAmount: 0,
              currency: 'KES',
              reason: `Fee waived - driver was en route longer than ${rule.waiveFeeIfDriverDelayedSeconds}s`,
            };
          }
        }
        return {
          feeApplicable: true,
          feeAmount: rule.driverEnRouteFee,
          currency: 'KES',
          reason: 'Cancelled after grace period while driver was en route',
        };
      }
    }

    // 6. Past grace period but driver not yet dispatched/en route -> no fee.
    return {
      feeApplicable: false,
      feeAmount: 0,
      currency: 'KES',
      reason: 'Cancelled after grace period but before driver was en route',
    };
  }

  async upsertRule(rule: CancellationFeeRule): Promise<CancellationFeeRule> {
    if (rule.gracePeriodSeconds < 0 || rule.driverEnRouteFee < 0 || rule.driverArrivedFee < 0) {
      throw new FareEngineError(
        'INVALID_CANCELLATION_RULE',
        'gracePeriodSeconds, driverEnRouteFee and driverArrivedFee must be >= 0',
      );
    }
    return this.repo.upsertRule(rule);
  }
}
