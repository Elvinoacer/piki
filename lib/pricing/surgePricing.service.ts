// src/services/surgePricing.service.ts
// Admin-configurable surge multipliers triggered by time window, weather, or demand ratio (3.4 bullet 2).

import { SurgeConfigGlobal, SurgeRule, FareEngineError } from './types';

export interface SurgeRepository {
  listActiveRulesForZone(zoneId: string): Promise<SurgeRule[]>;
  upsertRule(rule: SurgeRule): Promise<SurgeRule>;
  getGlobalConfig(): Promise<SurgeConfigGlobal>;
  setGlobalConfig(config: SurgeConfigGlobal): Promise<SurgeConfigGlobal>;
  /** Live demand ratio (riders waiting / drivers available) for a zone, from dispatch service. */
  getCurrentDemandRatio(zoneId: string): Promise<number>;
  /** Current weather condition for a zone, from weather provider integration. */
  getCurrentWeatherCondition(zoneId: string): Promise<string | null>;
}

export class InMemorySurgeRepository implements SurgeRepository {
  private rules = new Map<string, SurgeRule>();
  private global: SurgeConfigGlobal = { maxAllowedMultiplier: 3.0, enabled: true };
  // injectable hooks so tests / sibling services can simulate live signals
  public demandRatios = new Map<string, number>();
  public weatherConditions = new Map<string, string | null>();

  constructor(seed: SurgeRule[] = defaultSurgeSeed) {
    seed.forEach((r) => this.rules.set(r.id, r));
  }

  async listActiveRulesForZone(zoneId: string): Promise<SurgeRule[]> {
    return [...this.rules.values()]
      .filter((r) => r.zoneId === zoneId && r.isActive)
      .sort((a, b) => b.priority - a.priority);
  }

  async upsertRule(rule: SurgeRule): Promise<SurgeRule> {
    this.rules.set(rule.id, rule);
    return rule;
  }

  async getGlobalConfig(): Promise<SurgeConfigGlobal> {
    return this.global;
  }

  async setGlobalConfig(config: SurgeConfigGlobal): Promise<SurgeConfigGlobal> {
    this.global = config;
    return config;
  }

  async getCurrentDemandRatio(zoneId: string): Promise<number> {
    return this.demandRatios.get(zoneId) ?? 1.0;
  }

  async getCurrentWeatherCondition(zoneId: string): Promise<string | null> {
    return this.weatherConditions.get(zoneId) ?? null;
  }
}

export const defaultSurgeSeed: SurgeRule[] = [
  {
    id: 'surge_nairobi_morning_peak',
    zoneId: 'zp_nairobi_bodaboda',
    triggerType: 'time_window',
    multiplier: 1.3,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '06:30',
    endTime: '09:00',
    isActive: true,
    priority: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'surge_nairobi_evening_peak',
    zoneId: 'zp_nairobi_bodaboda',
    triggerType: 'time_window',
    multiplier: 1.4,
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '17:00',
    endTime: '20:00',
    isActive: true,
    priority: 10,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'surge_nairobi_rain',
    zoneId: 'zp_nairobi_bodaboda',
    triggerType: 'weather',
    multiplier: 1.5,
    weatherCondition: 'heavy_rain',
    isActive: true,
    priority: 20,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'surge_nairobi_high_demand',
    zoneId: 'zp_nairobi_bodaboda',
    triggerType: 'demand_ratio',
    multiplier: 1.6,
    demandThreshold: 3.0,
    isActive: true,
    priority: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

export interface SurgeEvaluationResult {
  multiplier: number;
  appliedRules: { ruleId: string; triggerType: string; multiplier: number }[];
}

export class SurgePricingService {
  constructor(private repo: SurgeRepository) {}

  /**
   * Evaluates all active surge rules for a zone at a given time and returns the
   * EFFECTIVE multiplier. Strategy: highest-priority matching rule wins
   * (rules are not stacked/multiplied to avoid runaway pricing); result is
   * clamped to the global maxAllowedMultiplier.
   */
  async getEffectiveMultiplier(zoneId: string, atIso: string): Promise<SurgeEvaluationResult> {
    const globalConfig = await this.repo.getGlobalConfig();
    if (!globalConfig.enabled) {
      return { multiplier: 1.0, appliedRules: [] };
    }

    const rules = await this.repo.listActiveRulesForZone(zoneId);
    const at = new Date(atIso);
    const matched: { ruleId: string; triggerType: string; multiplier: number; priority: number }[] = [];

    for (const rule of rules) {
      const isMatch = await this.ruleMatches(rule, zoneId, at);
      if (isMatch) {
        matched.push({
          ruleId: rule.id,
          triggerType: rule.triggerType,
          multiplier: rule.multiplier,
          priority: rule.priority,
        });
      }
    }

    if (matched.length === 0) {
      return { multiplier: 1.0, appliedRules: [] };
    }

    matched.sort((a, b) => b.priority - a.priority);
    const top = matched[0];
    const clamped = Math.min(top.multiplier, globalConfig.maxAllowedMultiplier);

    return {
      multiplier: clamped,
      appliedRules: [{ ruleId: top.ruleId, triggerType: top.triggerType, multiplier: clamped }],
    };
  }

  private async ruleMatches(rule: SurgeRule, zoneId: string, at: Date): Promise<boolean> {
    switch (rule.triggerType) {
      case 'time_window':
        return this.matchesTimeWindow(rule, at);
      case 'weather': {
        const current = await this.repo.getCurrentWeatherCondition(zoneId);
        return current !== null && current === rule.weatherCondition;
      }
      case 'demand_ratio': {
        const ratio = await this.repo.getCurrentDemandRatio(zoneId);
        return rule.demandThreshold !== undefined && ratio >= rule.demandThreshold;
      }
      case 'manual':
        return rule.isActive; // manually toggled on/off by admin via isActive
      default:
        return false;
    }
  }

  private matchesTimeWindow(rule: SurgeRule, at: Date): boolean {
    if (!rule.startTime || !rule.endTime) return false;
    const day = at.getUTCDay();
    if (rule.daysOfWeek && !rule.daysOfWeek.includes(day)) return false;

    const minutesNow = at.getUTCHours() * 60 + at.getUTCMinutes();
    const [startH, startM] = rule.startTime.split(':').map(Number);
    const [endH, endM] = rule.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return minutesNow >= startMinutes && minutesNow < endMinutes;
    }
    // window crosses midnight
    return minutesNow >= startMinutes || minutesNow < endMinutes;
  }

  async upsertRule(rule: SurgeRule): Promise<SurgeRule> {
    if (rule.multiplier < 1.0) {
      throw new FareEngineError('INVALID_SURGE_MULTIPLIER', 'Surge multiplier must be >= 1.0');
    }
    const global = await this.repo.getGlobalConfig();
    if (rule.multiplier > global.maxAllowedMultiplier) {
      throw new FareEngineError(
        'SURGE_EXCEEDS_CAP',
        `Surge multiplier ${rule.multiplier} exceeds platform cap ${global.maxAllowedMultiplier}`,
      );
    }
    return this.repo.upsertRule(rule);
  }

  async setGlobalConfig(config: SurgeConfigGlobal): Promise<SurgeConfigGlobal> {
    if (config.maxAllowedMultiplier < 1.0) {
      throw new FareEngineError(
        'INVALID_GLOBAL_CONFIG',
        'maxAllowedMultiplier must be >= 1.0',
      );
    }
    return this.repo.setGlobalConfig(config);
  }
}
