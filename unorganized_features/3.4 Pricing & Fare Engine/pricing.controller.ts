// src/controllers/pricing.controller.ts
// HTTP layer (Express). Translates requests/responses; all business logic lives in services.

import { Request, Response, Router } from 'express';
import { FareEngineError, FareEstimateRequest, VehicleType } from '../models/types';
import { FareEngineService } from '../services/fareEngine.service';
import { SurgePricingService } from '../services/surgePricing.service';
import { ZonePricingService } from '../services/zonePricing.service';
import { CancellationFeeService } from '../services/cancellationFee.service';
import { NegotiationService } from '../services/negotiation.service';
import { PromoService } from '../services/promo.service';

export interface PricingControllerDeps {
  fareEngine: FareEngineService;
  zonePricing: ZonePricingService;
  surgePricing: SurgePricingService;
  cancellationFee: CancellationFeeService;
  negotiation: NegotiationService;
  promo: PromoService;
  /**
   * In-memory cache of estimates so negotiation endpoints can re-derive
   * negotiationBounds without recomputing the whole estimate. In production
   * back this with Redis (short TTL matching estimateValidityMinutes).
   */
  estimateCache: Map<string, { total: number; negotiationBounds?: import('../models/types').NegotiationBounds }>;
}

const VALID_VEHICLE_TYPES: VehicleType[] = ['bodaboda', 'tuktuk', 'standard', 'xl', 'comfort'];

export function createPricingRouter(deps: PricingControllerDeps): Router {
  const router = Router();

  // POST /api/v1/pricing/estimate
  router.post('/estimate', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const validationError = validateEstimateRequest(body);
      if (validationError) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: validationError } });
      }

      const fareReq: FareEstimateRequest = {
        riderId: body.riderId,
        vehicleType: body.vehicleType,
        pickup: body.pickup,
        dropoff: body.dropoff,
        promoCode: body.promoCode,
        useReferralCredits: body.useReferralCredits,
        countyCode: body.countyCode,
        requestedAtIso: body.requestedAtIso,
      };

      const estimate = await deps.fareEngine.generateEstimate(fareReq);

      deps.estimateCache.set(estimate.estimateId, {
        total: estimate.breakdown.total,
        negotiationBounds: estimate.negotiationBounds,
      });

      return res.status(200).json(estimate);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // GET /api/v1/pricing/zones
  router.get('/zones', async (_req: Request, res: Response) => {
    try {
      const zones = await deps.zonePricing.list();
      return res.status(200).json({ zones });
    } catch (err) {
      return handleError(err, res);
    }
  });

  // PUT /api/v1/pricing/zones/:id  (admin)
  router.put('/zones/:id', async (req: Request, res: Response) => {
    try {
      const config = { ...req.body, id: req.params.id };
      const updated = await deps.zonePricing.upsertConfig(config);
      return res.status(200).json(updated);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // PUT /api/v1/pricing/surge/rules/:id  (admin)
  router.put('/surge/rules/:id', async (req: Request, res: Response) => {
    try {
      const rule = { ...req.body, id: req.params.id };
      const updated = await deps.surgePricing.upsertRule(rule);
      return res.status(200).json(updated);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // PUT /api/v1/pricing/surge/config  (admin - global cap / enable toggle)
  router.put('/surge/config', async (req: Request, res: Response) => {
    try {
      const updated = await deps.surgePricing.setGlobalConfig(req.body);
      return res.status(200).json(updated);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // POST /api/v1/pricing/cancellation-fee
  router.post('/cancellation-fee', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      if (!body.vehicleType || !body.bookingConfirmedAt || !body.cancelledAt || !body.cancelledBy) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'vehicleType, bookingConfirmedAt, cancelledAt and cancelledBy are required',
          },
        });
      }
      const result = await deps.cancellationFee.calculate(body);
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // POST /api/v1/pricing/negotiations
  router.post('/negotiations', async (req: Request, res: Response) => {
    try {
      const { estimateId, proposedFare } = req.body ?? {};
      if (!estimateId || typeof proposedFare !== 'number') {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'estimateId and proposedFare are required' },
        });
      }

      const cached = deps.estimateCache.get(estimateId);
      if (!cached) {
        return res.status(404).json({
          error: { code: 'ESTIMATE_NOT_FOUND', message: `No estimate found for ${estimateId} (it may have expired)` },
        });
      }
      if (!cached.negotiationBounds) {
        return res.status(409).json({
          error: { code: 'NEGOTIATION_NOT_SUPPORTED', message: 'This vehicle type does not support fare negotiation' },
        });
      }

      const negotiation = await deps.negotiation.startNegotiation(
        estimateId,
        cached.total,
        cached.negotiationBounds,
        proposedFare,
      );
      return res.status(201).json(negotiation);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // POST /api/v1/pricing/negotiations/:id/counter
  router.post('/negotiations/:id/counter', async (req: Request, res: Response) => {
    try {
      const { actor, proposedFare, estimateId } = req.body ?? {};
      if (!actor || typeof proposedFare !== 'number' || !estimateId) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'actor, proposedFare and estimateId are required' },
        });
      }
      const cached = deps.estimateCache.get(estimateId);
      if (!cached?.negotiationBounds) {
        return res.status(404).json({
          error: { code: 'ESTIMATE_NOT_FOUND', message: `No negotiable estimate found for ${estimateId}` },
        });
      }

      const negotiation = await deps.negotiation.counterOffer(
        req.params.id,
        actor,
        proposedFare,
        cached.negotiationBounds,
      );
      return res.status(200).json(negotiation);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // POST /api/v1/pricing/negotiations/:id/accept
  router.post('/negotiations/:id/accept', async (req: Request, res: Response) => {
    try {
      const negotiation = await deps.negotiation.acceptOffer(req.params.id);
      return res.status(200).json(negotiation);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // POST /api/v1/pricing/negotiations/:id/reject
  router.post('/negotiations/:id/reject', async (req: Request, res: Response) => {
    try {
      const negotiation = await deps.negotiation.rejectOffer(req.params.id);
      return res.status(200).json(negotiation);
    } catch (err) {
      return handleError(err, res);
    }
  });

  // GET /api/v1/pricing/promo/:code/validate?riderId=&countyCode=&vehicleType=&subtotal=
  router.get('/promo/:code/validate', async (req: Request, res: Response) => {
    try {
      const { riderId, countyCode, vehicleType, subtotal } = req.query;
      if (!riderId || !countyCode || !vehicleType || subtotal === undefined) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'riderId, countyCode, vehicleType and subtotal query params are required',
          },
        });
      }
      const result = await deps.promo.validateAndCompute(req.params.code, {
        riderId: String(riderId),
        countyCode: String(countyCode),
        vehicleType: String(vehicleType) as VehicleType,
        subtotal: Number(subtotal),
        atIso: new Date().toISOString(),
      });
      return res.status(200).json(result);
    } catch (err) {
      return handleError(err, res);
    }
  });

  return router;
}

function validateEstimateRequest(body: any): string | null {
  if (!body.riderId) return 'riderId is required';
  if (!body.vehicleType || !VALID_VEHICLE_TYPES.includes(body.vehicleType)) {
    return `vehicleType must be one of: ${VALID_VEHICLE_TYPES.join(', ')}`;
  }
  if (!isLatLng(body.pickup)) return 'pickup must be { lat, lng }';
  if (!isLatLng(body.dropoff)) return 'dropoff must be { lat, lng }';
  return null;
}

function isLatLng(v: any): boolean {
  return v && typeof v.lat === 'number' && typeof v.lng === 'number';
}

function handleError(err: unknown, res: Response): Response {
  if (err instanceof FareEngineError) {
    return res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
  }
  console.error('Unexpected error in pricing controller:', err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
}
