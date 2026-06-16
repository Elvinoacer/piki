// src/services/promo.service.ts
// Promo codes & referral credits (3.4 bullet 7).

import { FareEngineError, PromoCode, ReferralCreditBalance, VehicleType } from './types';

export interface PromoRepository {
  findByCode(code: string): Promise<PromoCode | null>;
  incrementUsage(code: string): Promise<void>;
  getUserUsageCount(code: string, riderId: string): Promise<number>;
  recordUsage(code: string, riderId: string, tripId: string): Promise<void>;
}

export interface ReferralCreditRepository {
  getBalance(riderId: string): Promise<ReferralCreditBalance>;
  debitBalance(riderId: string, amount: number): Promise<ReferralCreditBalance>;
  creditBalance(riderId: string, amount: number): Promise<ReferralCreditBalance>;
}

export class InMemoryPromoRepository implements PromoRepository {
  private promos = new Map<string, PromoCode>();
  private usage = new Map<string, number>(); // key: `${code}:${riderId}`

  constructor(seed: PromoCode[] = defaultPromoSeed) {
    seed.forEach((p) => this.promos.set(p.code.toUpperCase(), p));
  }

  async findByCode(code: string): Promise<PromoCode | null> {
    return this.promos.get(code.toUpperCase()) ?? null;
  }

  async incrementUsage(code: string): Promise<void> {
    const promo = this.promos.get(code.toUpperCase());
    if (promo) promo.currentUsageCount += 1;
  }

  async getUserUsageCount(code: string, riderId: string): Promise<number> {
    return this.usage.get(`${code.toUpperCase()}:${riderId}`) ?? 0;
  }

  async recordUsage(code: string, riderId: string, _tripId: string): Promise<void> {
    const key = `${code.toUpperCase()}:${riderId}`;
    this.usage.set(key, (this.usage.get(key) ?? 0) + 1);
  }
}

export const defaultPromoSeed: PromoCode[] = [
  {
    code: 'WELCOME50',
    type: 'percentage',
    value: 50,
    maxDiscountAmount: 100,
    minFareThreshold: 0,
    usageLimitPerUser: 1,
    currentUsageCount: 0,
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2030-01-01T00:00:00.000Z',
    isActive: true,
  },
  {
    code: 'BODA20',
    type: 'fixed_amount',
    value: 20,
    minFareThreshold: 100,
    vehicleTypeRestrictions: ['bodaboda'],
    countyRestrictions: ['047'],
    usageLimitPerUser: 5,
    currentUsageCount: 0,
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2030-01-01T00:00:00.000Z',
    isActive: true,
  },
  {
    code: 'NOBOOKINGFEE',
    type: 'free_booking_fee',
    value: 0,
    usageLimitPerUser: 3,
    currentUsageCount: 0,
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2030-01-01T00:00:00.000Z',
    isActive: true,
  },
];

export class InMemoryReferralCreditRepository implements ReferralCreditRepository {
  private balances = new Map<string, number>();

  async getBalance(riderId: string): Promise<ReferralCreditBalance> {
    return { riderId, balance: this.balances.get(riderId) ?? 0, currency: 'KES' };
  }

  async debitBalance(riderId: string, amount: number): Promise<ReferralCreditBalance> {
    const current = this.balances.get(riderId) ?? 0;
    const next = Math.max(0, current - amount);
    this.balances.set(riderId, next);
    return { riderId, balance: next, currency: 'KES' };
  }

  async creditBalance(riderId: string, amount: number): Promise<ReferralCreditBalance> {
    const current = this.balances.get(riderId) ?? 0;
    const next = current + amount;
    this.balances.set(riderId, next);
    return { riderId, balance: next, currency: 'KES' };
  }
}

export interface PromoApplicationContext {
  riderId: string;
  countyCode: string;
  vehicleType: VehicleType;
  subtotal: number; // amount the promo applies against (subtotal after surge, before promo)
  atIso: string;
}

export interface PromoApplicationResult {
  promoDiscount: number;
  bookingFeeWaived: boolean;
  promoCode?: string;
}

export class PromoService {
  constructor(
    private promoRepo: PromoRepository,
    private referralRepo: ReferralCreditRepository,
  ) {}

  /**
   * Validates a promo code against context and returns the discount to apply.
   * Throws FareEngineError with code PROMO_* on any validation failure so the
   * caller can decide whether to surface it (e.g. during estimate) or just
   * silently ignore it (some flows prefer to drop an invalid promo rather
   * than fail the whole fare calc - controller decides).
   */
  async validateAndCompute(
    code: string,
    ctx: PromoApplicationContext,
  ): Promise<PromoApplicationResult> {
    const promo = await this.promoRepo.findByCode(code);
    if (!promo) {
      throw new FareEngineError('PROMO_NOT_FOUND', `Promo code "${code}" not found`, 404);
    }
    if (!promo.isActive) {
      throw new FareEngineError('PROMO_INACTIVE', `Promo code "${code}" is no longer active`);
    }

    const now = new Date(ctx.atIso);
    if (now < new Date(promo.validFrom) || now > new Date(promo.validTo)) {
      throw new FareEngineError('PROMO_EXPIRED', `Promo code "${code}" is not valid at this time`);
    }

    if (promo.totalUsageLimit !== undefined && promo.currentUsageCount >= promo.totalUsageLimit) {
      throw new FareEngineError('PROMO_USAGE_LIMIT_REACHED', `Promo code "${code}" usage limit reached`);
    }

    if (promo.usageLimitPerUser !== undefined) {
      const userUsage = await this.promoRepo.getUserUsageCount(code, ctx.riderId);
      if (userUsage >= promo.usageLimitPerUser) {
        throw new FareEngineError(
          'PROMO_USER_LIMIT_REACHED',
          `You have already used promo code "${code}" the maximum number of times`,
        );
      }
    }

    if (promo.countyRestrictions?.length && !promo.countyRestrictions.includes(ctx.countyCode)) {
      throw new FareEngineError('PROMO_COUNTY_RESTRICTED', `Promo code "${code}" is not valid in this area`);
    }

    if (
      promo.vehicleTypeRestrictions?.length &&
      !promo.vehicleTypeRestrictions.includes(ctx.vehicleType)
    ) {
      throw new FareEngineError(
        'PROMO_VEHICLE_RESTRICTED',
        `Promo code "${code}" is not valid for this vehicle type`,
      );
    }

    if (promo.minFareThreshold !== undefined && ctx.subtotal < promo.minFareThreshold) {
      throw new FareEngineError(
        'PROMO_BELOW_MIN_FARE',
        `Promo code "${code}" requires a minimum fare of ${promo.minFareThreshold}`,
      );
    }

    switch (promo.type) {
      case 'percentage': {
        let discount = ctx.subtotal * (promo.value / 100);
        if (promo.maxDiscountAmount !== undefined) {
          discount = Math.min(discount, promo.maxDiscountAmount);
        }
        return { promoDiscount: round2(discount), bookingFeeWaived: false, promoCode: promo.code };
      }
      case 'fixed_amount': {
        const discount = Math.min(promo.value, ctx.subtotal);
        return { promoDiscount: round2(discount), bookingFeeWaived: false, promoCode: promo.code };
      }
      case 'free_booking_fee':
        return { promoDiscount: 0, bookingFeeWaived: true, promoCode: promo.code };
      default:
        throw new FareEngineError('PROMO_UNKNOWN_TYPE', `Unknown promo type for "${code}"`);
    }
  }

  /** Called only after a trip is confirmed/paid to record usage and decrement counters. */
  async commitUsage(code: string, riderId: string, tripId: string): Promise<void> {
    await this.promoRepo.incrementUsage(code);
    await this.promoRepo.recordUsage(code, riderId, tripId);
  }

  /**
   * Applies available referral credits up to `maxApplicable` (the remaining
   * fare after promo discount). Does not debit the balance - that happens
   * at trip-completion/payment time via commitReferralDebit.
   */
  async previewReferralCredit(riderId: string, maxApplicable: number): Promise<number> {
    const balance = await this.referralRepo.getBalance(riderId);
    return round2(Math.min(balance.balance, Math.max(0, maxApplicable)));
  }

  async commitReferralDebit(riderId: string, amount: number): Promise<ReferralCreditBalance> {
    if (amount <= 0) return this.referralRepo.getBalance(riderId);
    return this.referralRepo.debitBalance(riderId, amount);
  }

  async creditReferralBonus(riderId: string, amount: number): Promise<ReferralCreditBalance> {
    return this.referralRepo.creditBalance(riderId, amount);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
