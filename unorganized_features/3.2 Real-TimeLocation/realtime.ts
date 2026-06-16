/**
 * types/realtime.ts
 *
 * Shared TypeScript types for Section 3.2 — Real-Time Location & Matching.
 * Import these in both client and server code for type-safe WS event payloads.
 */

import type { TripStatus, TripType, BroadcastResponse } from "@prisma/client";

// ─── WebSocket Event Payloads ─────────────────────────────────
// Naming convention: <subject>:<verb>[:<modifier>]

/** Server → Client: matching engine is searching for riders */
export interface TripSearchingPayload {
  tripId:      string;
  radiusKm:    number;
  ridersFound?: number;
}

/** Server → Client: a rider accepted the trip */
export interface TripAcceptedPayload {
  tripId:   string;
  riderId:  string;
  status:   TripStatus;
}

/** Server → Client & Rider: generic status transition */
export interface TripStatusUpdatePayload {
  tripId: string;
  status: TripStatus;
  ts:     number;
}

/** Server → Client: no rider found, trip expired */
export interface TripExpiredPayload {
  tripId:  string;
  message: string;
}

/** Server → Rider: incoming trip offer */
export interface TripOfferPayload {
  tripId:      string;
  timeoutSecs: number;
  trip: {
    pickupAddress:  string;
    dropoffAddress: string;
    distanceKm?:    number;
    estimatedMins?: number;
    fareEstimate?:  number;
    type:           TripType;
  };
}

/** Server → Rider: trip offer was taken by another rider */
export interface TripOfferTakenPayload {
  tripId: string;
}

/** Server → Rider: offer countdown expired */
export interface TripOfferExpiredPayload {
  tripId: string;
}

/** Rider → Server (and Server → Client via trip room): live GPS update */
export interface RiderLocationPayload {
  lat:       number;
  lng:       number;
  heading?:  number;
  speedKmh?: number;
  accuracy?: number;
  tripId?:   string;
}

/** Server → Client: enhanced location update with metadata */
export interface RiderLocationUpdatePayload {
  tripId:    string;
  riderId:   string;
  lat:       number;
  lng:       number;
  heading?:  number;
  speedKmh?: number;
  ts:        number;
}

/** Server → Rider: instruct rider client to join the shared trip room */
export interface TripRoomJoinPayload {
  tripId: string;
}

// ─── REST API ─────────────────────────────────────────────────

/** POST /api/trips request body */
export interface CreateTripBody {
  pickupLat:      number;
  pickupLng:      number;
  pickupAddress:  string;
  dropoffLat:     number;
  dropoffLng:     number;
  dropoffAddress: string;
  type?:          TripType;
  distanceKm?:    number;
  estimatedMins?: number;
  fareEstimate?:  number;
  stops?: Array<{
    lat:     number;
    lng:     number;
    address: string;
    order:   number;
  }>;
}

/** PATCH /api/trips/:id/status request body */
export interface UpdateTripStatusBody {
  action: "accept" | "decline" | "arriving" | "arrived" | "start" | "complete" | "cancel";
  cancelReason?: string;
}

/** GET /api/riders/nearby response */
export interface NearbyRiderPin {
  riderId:        string;
  lat:            number;
  lng:            number;
  heading:        number | null;
  distanceMetres: number;
  rating:         number;
}

/** PUT /api/location request body */
export interface BatchLocationBody {
  points: Array<{
    lat:       number;
    lng:       number;
    heading?:  number;
    speedKmh?: number;
    accuracy?: number;
    ts:        number;
    tripId?:   string;
  }>;
}

// ─── Matching engine ──────────────────────────────────────────

export type DispatchStrategy = "BROADCAST" | "SEQUENTIAL";

export interface MatchingEngineConfig {
  startRadiusKm:       number;
  expandRadiusKm:      number;
  maxRadiusKm:         number;
  waitSecsPerStep:     number;
  dispatchStrategy:    DispatchStrategy;
  broadcastBatchSize?: number;
  perRiderTimeoutSecs?: number;
}

// ─── Zone / Geofence ─────────────────────────────────────────

export interface ZoneGeoJSON {
  type:        "Feature";
  geometry: {
    type:        "Polygon";
    coordinates: number[][][];
  };
  properties: {
    id:         string;
    name:       string;
    county:     string;
    status:     "ACTIVE" | "INACTIVE" | "COMING_SOON";
    baseFareKes: number;
    perKmKes:   number;
    perMinKes:  number;
  };
}
