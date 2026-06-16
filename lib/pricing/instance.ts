import { SurgePricingService, InMemorySurgeRepository } from "./surgePricing.service";
import { ZonePricingService, InMemoryZonePricingRepository } from "./zonePricing.service";
import { CancellationFeeService, InMemoryCancellationFeeRepository } from "./cancellationFee.service";
import { NegotiationService, InMemoryNegotiationRepository } from "./negotiation.service";
import { PromoService, InMemoryPromoRepository, InMemoryReferralCreditRepository } from "./promo.service";
import { GoogleDirectionsProvider, MapboxDirectionsProvider, FallbackRoutingProvider } from "./routing.service";
import { FareEngineService, StaticCountyGeocodingService } from "./fareEngine.service";
import type { NegotiationBounds } from "./types";

// Repositories
const zoneRepo = new InMemoryZonePricingRepository();
const surgeRepo = new InMemorySurgeRepository();
const cancellationRepo = new InMemoryCancellationFeeRepository();
const negotiationRepo = new InMemoryNegotiationRepository();
const promoRepo = new InMemoryPromoRepository();

const referralRepo = new InMemoryReferralCreditRepository();

// Services
export const zonePricingService = new ZonePricingService(zoneRepo);
export const surgePricingService = new SurgePricingService(surgeRepo);
export const cancellationFeeService = new CancellationFeeService(cancellationRepo);
export const negotiationService = new NegotiationService(negotiationRepo);
export const promoService = new PromoService(promoRepo, referralRepo);

export const googleDirections = new GoogleDirectionsProvider(process.env.GOOGLE_MAPS_API_KEY || '');
export const mapboxDirections = new MapboxDirectionsProvider(process.env.MAPBOX_ACCESS_TOKEN || '');
export const routingService = new FallbackRoutingProvider(googleDirections, mapboxDirections);

export const geocodingService = new StaticCountyGeocodingService();

export const fareEngineService = new FareEngineService(
  zonePricingService,
  surgePricingService,
  promoService,
  routingService,
  geocodingService
);

// Estimate Cache
export const estimateCache = new Map<string, { total: number; negotiationBounds?: NegotiationBounds }>();
