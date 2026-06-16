/**
 * lib/matching/algorithm.ts
 *
 * Pikii Rider Matching Algorithm
 *
 * Score = weighted combination of:
 *   • Proximity     (closer is better)       — 40%
 *   • Rating        (higher is better)        — 30%
 *   • Acceptance    (reliable riders win)     — 20%
 *   • Idle time     (fairness rotation)       — 10%
 *
 * All inputs are normalised to [0, 1] before weighting
 * so no dimension dominates by raw magnitude.
 */

import type { NearbyRider } from "@/lib/geo/queries";

// ─── Weights (must sum to 1.0) ───────────────────────────────

const W = {
  proximity:    0.40,
  rating:       0.30,
  acceptance:   0.20,
  idleness:     0.10,
} as const;

// ─── Constants ───────────────────────────────────────────────

const MAX_RATING          = 5.0;
const MAX_IDLE_SECS       = 30 * 60; // 30 min cap — beyond this all treated equal
const MAX_DISTANCE_METRES = 10_000;  // 10 km (matches max search radius)

// ─── Types ───────────────────────────────────────────────────

export interface ScoredRider extends NearbyRider {
  score: number; // 0.0 – 1.0 (higher is better)
}

// ─── Algorithm ───────────────────────────────────────────────

/**
 * Score and rank a list of nearby riders.
 * Input: raw candidates from findNearbyRiders()
 * Output: sorted descending by score (best first)
 */
export function rankRiders(candidates: NearbyRider[]): ScoredRider[] {
  if (candidates.length === 0) return [];

  return candidates
    .map((r) => ({
      ...r,
      score: computeScore(r),
    }))
    .sort((a, b) => b.score - a.score);
}

function computeScore(r: NearbyRider): number {
  const proximityScore  = normalizeProximity(r.distanceMetres);
  const ratingScore     = r.rating / MAX_RATING;
  const acceptanceScore = Math.min(r.acceptanceRate, 1.0);
  const idleScore       = normalizeIdle(r.idleSeconds);

  return (
    W.proximity   * proximityScore  +
    W.rating      * ratingScore     +
    W.acceptance  * acceptanceScore +
    W.idleness    * idleScore
  );
}

/**
 * Proximity: inverse linear — 0 m → 1.0, MAX → 0.0
 * Small bonus curve at very close range (<500 m) to strongly prefer
 * the rider who is practically at the client's door.
 */
function normalizeProximity(metres: number): number {
  const clamped = Math.min(metres, MAX_DISTANCE_METRES);
  const linear  = 1 - clamped / MAX_DISTANCE_METRES;

  // Boost for riders within 500 m
  if (metres <= 500) {
    return 0.7 + (0.3 * (500 - metres) / 500);
  }
  return linear;
}

/**
 * Idle time: more idle = higher score (fairness rotation).
 * Logarithmic: big jump early, flattens after 10+ min.
 * Riders idle >30 min treated equally — all capped at 1.0.
 */
function normalizeIdle(seconds: number): number {
  if (seconds <= 0) return 0;
  const capped = Math.min(seconds, MAX_IDLE_SECS);
  return Math.log(1 + capped) / Math.log(1 + MAX_IDLE_SECS);
}

// ─── Dispatch plan builder ────────────────────────────────────

export interface DispatchPlan {
  strategy: "BROADCAST" | "SEQUENTIAL";
  batches: string[][]; // riderId batches; broadcast = one batch; sequential = one per batch
}

/**
 * Build a dispatch plan from ranked riders.
 *
 * BROADCAST: send to top N riders simultaneously (first-accept wins).
 * SEQUENTIAL: offer to #1, wait, then #2, etc.
 */
export function buildDispatchPlan(
  ranked: ScoredRider[],
  strategy: "BROADCAST" | "SEQUENTIAL",
  broadcastBatchSize = 5
): DispatchPlan {
  if (strategy === "BROADCAST") {
    return {
      strategy: "BROADCAST",
      batches: [ranked.slice(0, broadcastBatchSize).map((r) => r.riderId)],
    };
  }

  // Sequential: each rider gets their own batch
  return {
    strategy: "SEQUENTIAL",
    batches: ranked.map((r) => [r.riderId]),
  };
}

// ─── Radius expansion schedule ────────────────────────────────

export interface RadiusStep {
  radiusKm: number;
  waitSecs: number; // Wait this long before moving to next step
}

/**
 * Generate an expanding radius schedule.
 *
 * Example output for startKm=3, expandKm=2, maxKm=10, waitSecs=30:
 *   [ { radiusKm: 3, waitSecs: 30 },
 *     { radiusKm: 5, waitSecs: 30 },
 *     { radiusKm: 7, waitSecs: 30 },
 *     { radiusKm: 9, waitSecs: 30 } ]  ← stops at max
 */
export function buildRadiusSchedule(opts: {
  startKm: number;
  expandKm: number;
  maxKm: number;
  waitSecsPerStep: number;
}): RadiusStep[] {
  const { startKm, expandKm, maxKm, waitSecsPerStep } = opts;
  const steps: RadiusStep[] = [];
  let current = startKm;

  while (current <= maxKm) {
    steps.push({ radiusKm: current, waitSecs: waitSecsPerStep });
    current += expandKm;
  }

  return steps;
}
