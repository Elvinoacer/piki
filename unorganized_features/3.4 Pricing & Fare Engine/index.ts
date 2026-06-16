// src/index.ts
// Composition root - wires repositories/services and exports a router ready
// to be mounted on the main Express app, e.g.:
//
//   import { createPricingModule } from './pricing/src';
//   app.use('/api/v1/pricing', createPricingModule().router);

import { createPricingRouter } from './controllers/pricing.controller';
import { CancellationFeeService, InMemoryCancellationFeeRepository } from './services/cancellationFee.service';
import { defaultFareEngineConfig, FareEngineService, StaticCountyGeocodingService } from './services/fareEngine.service';
import { NegotiationService, InMemoryNegotiationRepository } from './services/negotiation.service';
import { InMemoryPromoRepository, InMemoryReferralCreditRepository, PromoService } from './services/promo.service';
import {
  FallbackRoutingProvider,
  GoogleDirectionsProvider,
  MapboxDirectionsProvider,
  RoutingProvider,
} from './services/routing.service';
import { InMemorySurgeRepository, SurgePricingService } from './services/surgePricing.service';
import { InMemoryZonePricingRepository, ZonePricingService } from './services/zonePricing.service';
import { NegotiationBounds } from './models/types';

export * from './models/types';
export * from './services/zonePricing.service';
export * from './services/surgePricing.service';
export * from './services/routing.service';
export * from './services/promo.service';
export * from './services/cancellationFee.service';
export * from './services/fareEngine.service';
export * from './services/negotiation.service';
export * from './controllers/pricing.controller';

export interface PricingModuleOptions {
  /** Override the routing provider, e.g. inject a mock for tests. */
  routingProvider?: RoutingProvider;
  fareEngineConfig?: typeof defaultFareEngineConfig;
}

function buildDefaultRoutingProvider(): RoutingProvider {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;

  if (googleKey && mapboxToken) {
    return new FallbackRoutingProvider(
      new GoogleDirectionsProvider(googleKey),
      new MapboxDirectionsProvider(mapboxToken),
    );
  }
  if (googleKey) return new GoogleDirectionsProvider(googleKey);
  if (mapboxToken) return new MapboxDirectionsProvider(mapboxToken);

  throw new Error(
    'No routing provider configured. Set GOOGLE_MAPS_API_KEY and/or MAPBOX_ACCESS_TOKEN, ' +
      'or pass a routingProvider override to createPricingModule().',
  );
}

export function createPricingModule(options: PricingModuleOptions = {}) {
  const zonePricingRepo = new InMemoryZonePricingRepository();
  const surgeRepo = new InMemorySurgeRepository();
  const promoRepo = new InMemoryPromoRepository();
  const referralRepo = new InMemoryReferralCreditRepository();
  const cancellationRepo = new InMemoryCancellationFeeRepository();
  const negotiationRepo = new InMemoryNegotiationRepository();

  const zonePricing = new ZonePricingService(zonePricingRepo);
  const surgePricing = new SurgePricingService(surgeRepo);
  const promo = new PromoService(promoRepo, referralRepo);
  const cancellationFee = new CancellationFeeService(cancellationRepo);
  const negotiation = new NegotiationService(negotiationRepo);
  const geocoding = new StaticCountyGeocodingService();
  const routingProvider = options.routingProvider ?? buildDefaultRoutingProvider();

  const fareEngine = new FareEngineService(
    zonePricing,
    surgePricing,
    promo,
    routingProvider,
    geocoding,
    options.fareEngineConfig ?? defaultFareEngineConfig,
  );

  const estimateCache = new Map<string, { total: number; negotiationBounds?: NegotiationBounds }>();

  const router = createPricingRouter({
    fareEngine,
    zonePricing,
    surgePricing,
    cancellationFee,
    negotiation,
    promo,
    estimateCache,
  });

  return {
    router,
    services: {
      zonePricing,
      surgePricing,
      promo,
      cancellationFee,
      negotiation,
      fareEngine,
    },
    repositories: {
      zonePricingRepo,
      surgeRepo,
      promoRepo,
      referralRepo,
      cancellationRepo,
      negotiationRepo,
    },
  };
}
