// src/services/negotiation.service.ts
// Optional fare negotiation mode: client/rider can counter-offer within bounds (3.4 bullet 4).

import { FareEngineError, FareNegotiation, NegotiationBounds, NegotiationRound } from './types';

export interface NegotiationRepository {
  create(negotiation: FareNegotiation): Promise<FareNegotiation>;
  findById(id: string): Promise<FareNegotiation | null>;
  update(negotiation: FareNegotiation): Promise<FareNegotiation>;
}

export class InMemoryNegotiationRepository implements NegotiationRepository {
  private store = new Map<string, FareNegotiation>();

  async create(negotiation: FareNegotiation): Promise<FareNegotiation> {
    this.store.set(negotiation.id, negotiation);
    return negotiation;
  }

  async findById(id: string): Promise<FareNegotiation | null> {
    return this.store.get(id) ?? null;
  }

  async update(negotiation: FareNegotiation): Promise<FareNegotiation> {
    this.store.set(negotiation.id, negotiation);
    return negotiation;
  }
}

const MAX_ROUNDS = 4; // cap back-and-forth to keep dispatch latency reasonable

export class NegotiationService {
  constructor(private repo: NegotiationRepository) {}

  /**
   * Starts a negotiation thread for a given estimate. The first round is
   * always the rider's counter-offer (per "client/rider can counter-offer").
   */
  async startNegotiation(
    estimateId: string,
    estimateTotal: number,
    bounds: NegotiationBounds,
    proposedFare: number,
  ): Promise<FareNegotiation> {
    this.assertWithinBounds(proposedFare, bounds);

    const now = new Date().toISOString();
    const negotiation: FareNegotiation = {
      id: generateNegotiationId(),
      estimateId,
      rounds: [
        {
          roundNumber: 1,
          actor: 'rider',
          proposedFare,
          status: 'pending',
          createdAt: now,
        },
      ],
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    return this.repo.create(negotiation);
  }

  /** Driver accepts the rider's current pending offer. */
  async acceptOffer(negotiationId: string): Promise<FareNegotiation> {
    const negotiation = await this.getOrThrow(negotiationId);
    const lastRound = this.lastRound(negotiation);

    if (lastRound.status !== 'pending') {
      throw new FareEngineError(
        'NEGOTIATION_NOT_PENDING',
        `Negotiation ${negotiationId} has no pending offer to accept`,
      );
    }

    lastRound.status = 'accepted';
    negotiation.status = 'accepted';
    negotiation.finalFare = lastRound.proposedFare;
    negotiation.updatedAt = new Date().toISOString();

    return this.repo.update(negotiation);
  }

  /** Driver (or rider) rejects the current pending offer outright. */
  async rejectOffer(negotiationId: string): Promise<FareNegotiation> {
    const negotiation = await this.getOrThrow(negotiationId);
    const lastRound = this.lastRound(negotiation);

    if (lastRound.status !== 'pending') {
      throw new FareEngineError(
        'NEGOTIATION_NOT_PENDING',
        `Negotiation ${negotiationId} has no pending offer to reject`,
      );
    }

    lastRound.status = 'rejected';
    negotiation.status = 'rejected';
    negotiation.updatedAt = new Date().toISOString();

    return this.repo.update(negotiation);
  }

  /**
   * Submits a counter-offer from either party. Bounds are always checked
   * against the original estimate's negotiationBounds (not the previous
   * offer) so the spread can't drift outside the admin-configured envelope
   * across multiple rounds.
   */
  async counterOffer(
    negotiationId: string,
    actor: 'rider' | 'driver',
    proposedFare: number,
    bounds: NegotiationBounds,
  ): Promise<FareNegotiation> {
    const negotiation = await this.getOrThrow(negotiationId);
    const lastRound = this.lastRound(negotiation);

    if (lastRound.status !== 'pending') {
      throw new FareEngineError(
        'NEGOTIATION_NOT_PENDING',
        `Negotiation ${negotiationId} is not awaiting a response`,
      );
    }

    if (lastRound.actor === actor) {
      throw new FareEngineError(
        'NEGOTIATION_WRONG_TURN',
        `It is not ${actor}'s turn to respond in negotiation ${negotiationId}`,
      );
    }

    if (negotiation.rounds.length >= MAX_ROUNDS) {
      throw new FareEngineError(
        'NEGOTIATION_MAX_ROUNDS_REACHED',
        `Negotiation ${negotiationId} has reached the maximum of ${MAX_ROUNDS} rounds`,
      );
    }

    this.assertWithinBounds(proposedFare, bounds);

    lastRound.status = 'countered';

    const newRound: NegotiationRound = {
      roundNumber: lastRound.roundNumber + 1,
      actor,
      proposedFare,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    negotiation.rounds.push(newRound);
    negotiation.status = 'pending';
    negotiation.updatedAt = new Date().toISOString();

    return this.repo.update(negotiation);
  }

  /** Marks an in-flight negotiation as expired (e.g. driver didn't respond in time). */
  async expire(negotiationId: string): Promise<FareNegotiation> {
    const negotiation = await this.getOrThrow(negotiationId);
    const lastRound = this.lastRound(negotiation);

    if (lastRound.status === 'pending') {
      lastRound.status = 'expired';
    }
    negotiation.status = 'expired';
    negotiation.updatedAt = new Date().toISOString();

    return this.repo.update(negotiation);
  }

  private assertWithinBounds(proposedFare: number, bounds: NegotiationBounds) {
    if (proposedFare < bounds.minFare || proposedFare > bounds.maxFare) {
      throw new FareEngineError(
        'NEGOTIATION_OUT_OF_BOUNDS',
        `Proposed fare ${proposedFare} is outside the allowed range [${bounds.minFare}, ${bounds.maxFare}]`,
      );
    }
    if (proposedFare <= 0) {
      throw new FareEngineError('NEGOTIATION_INVALID_AMOUNT', 'Proposed fare must be > 0');
    }
  }

  private lastRound(negotiation: FareNegotiation): NegotiationRound {
    return negotiation.rounds[negotiation.rounds.length - 1];
  }

  private async getOrThrow(id: string): Promise<FareNegotiation> {
    const negotiation = await this.repo.findById(id);
    if (!negotiation) {
      throw new FareEngineError('NEGOTIATION_NOT_FOUND', `Negotiation ${id} not found`, 404);
    }
    return negotiation;
  }
}

function generateNegotiationId(): string {
  return `neg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
