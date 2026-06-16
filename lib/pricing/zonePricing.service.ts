// src/services/zonePricing.service.ts
// Manages per-zone/county pricing configuration (3.4 bullet 1).
// Backed by a pluggable repository so the in-memory impl can be swapped for a DB-backed one.

import { FareEngineError, VehicleType, ZonePricingConfig } from './types';

export interface ZonePricingRepository {
  findActiveByCountyAndVehicle(
    countyCode: string,
    vehicleType: VehicleType,
    atIso: string,
  ): Promise<ZonePricingConfig | null>;
  findById(id: string): Promise<ZonePricingConfig | null>;
  list(): Promise<ZonePricingConfig[]>;
  upsert(config: ZonePricingConfig): Promise<ZonePricingConfig>;
}

/**
 * In-memory repository seeded with sample Kenyan county configs.
 * Replace with a Postgres/Mongo-backed implementation in production
 * (see migrations/001_zone_pricing.sql for the equivalent schema).
 */
export class InMemoryZonePricingRepository implements ZonePricingRepository {
  private store = new Map<string, ZonePricingConfig>();

  constructor(seed: ZonePricingConfig[] = defaultSeedConfigs) {
    seed.forEach((c) => this.store.set(c.id, c));
  }

  async findActiveByCountyAndVehicle(
    countyCode: string,
    vehicleType: VehicleType,
    atIso: string,
  ): Promise<ZonePricingConfig | null> {
    const at = new Date(atIso).getTime();
    const matches = [...this.store.values()].filter((c) => {
      if (c.countyCode !== countyCode) return false;
      if (c.vehicleType !== vehicleType) return false;
      if (!c.isActive) return false;
      const from = new Date(c.effectiveFrom).getTime();
      const to = c.effectiveTo ? new Date(c.effectiveTo).getTime() : Infinity;
      return at >= from && at <= to;
    });
    // most-recently-effective wins if multiple overlap
    matches.sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
    );
    return matches[0] ?? null;
  }

  async findById(id: string): Promise<ZonePricingConfig | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<ZonePricingConfig[]> {
    return [...this.store.values()];
  }

  async upsert(config: ZonePricingConfig): Promise<ZonePricingConfig> {
    this.store.set(config.id, config);
    return config;
  }
}

export const defaultSeedConfigs: ZonePricingConfig[] = [
  {
    id: 'zp_nairobi_bodaboda',
    countyCode: '047',
    zoneName: 'Nairobi Metro',
    vehicleType: 'bodaboda',
    baseFare: 50,
    perKmRate: 18,
    perMinuteRate: 2,
    minimumFare: 100,
    bookingFee: 10,
    currency: 'KES',
    isActive: true,
    effectiveFrom: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'zp_nairobi_standard',
    countyCode: '047',
    zoneName: 'Nairobi Metro',
    vehicleType: 'standard',
    baseFare: 100,
    perKmRate: 35,
    perMinuteRate: 4,
    minimumFare: 250,
    bookingFee: 20,
    currency: 'KES',
    isActive: true,
    effectiveFrom: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'zp_mombasa_bodaboda',
    countyCode: '043',
    zoneName: 'Mombasa Island & Mainland',
    vehicleType: 'bodaboda',
    baseFare: 45,
    perKmRate: 16,
    perMinuteRate: 1.8,
    minimumFare: 90,
    bookingFee: 10,
    currency: 'KES',
    isActive: true,
    effectiveFrom: '2024-01-01T00:00:00.000Z',
  },
];

export class ZonePricingService {
  constructor(private repo: ZonePricingRepository) {}

  async getActiveConfig(
    countyCode: string,
    vehicleType: VehicleType,
    atIso: string = new Date().toISOString(),
  ): Promise<ZonePricingConfig> {
    const config = await this.repo.findActiveByCountyAndVehicle(countyCode, vehicleType, atIso);
    if (!config) {
      throw new FareEngineError(
        'ZONE_PRICING_NOT_FOUND',
        `No active pricing config for county=${countyCode} vehicleType=${vehicleType} at ${atIso}`,
        404,
      );
    }
    return config;
  }

  async list(): Promise<ZonePricingConfig[]> {
    return this.repo.list();
  }

  /** Admin endpoint: create or update a zone pricing config. */
  async upsertConfig(config: ZonePricingConfig): Promise<ZonePricingConfig> {
    this.validate(config);
    return this.repo.upsert(config);
  }

  private validate(config: ZonePricingConfig) {
    if (config.baseFare < 0 || config.perKmRate < 0 || config.perMinuteRate < 0) {
      throw new FareEngineError(
        'INVALID_PRICING_CONFIG',
        'baseFare, perKmRate and perMinuteRate must be >= 0',
      );
    }
    if (config.minimumFare < 0 || config.bookingFee < 0) {
      throw new FareEngineError(
        'INVALID_PRICING_CONFIG',
        'minimumFare and bookingFee must be >= 0',
      );
    }
    if (config.effectiveTo && new Date(config.effectiveTo) <= new Date(config.effectiveFrom)) {
      throw new FareEngineError(
        'INVALID_PRICING_CONFIG',
        'effectiveTo must be after effectiveFrom',
      );
    }
  }
}
