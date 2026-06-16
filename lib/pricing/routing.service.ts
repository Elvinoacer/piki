// src/services/routing.service.ts
// Distance/time calculation via route polyline (Google Maps/Mapbox Directions API) - 3.4 bullet 5.

import { FareEngineError, RoutePolyline } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoutingProvider {
  getRoute(origin: LatLng, destination: LatLng): Promise<RoutePolyline>;
}

/**
 * Google Maps Directions API implementation.
 * Requires GOOGLE_MAPS_API_KEY to be set in the environment.
 */
export class GoogleDirectionsProvider implements RoutingProvider {
  constructor(private apiKey: string, private fetchFn: typeof fetch = fetch) {}

  async getRoute(origin: LatLng, destination: LatLng): Promise<RoutePolyline> {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${destination.lat},${destination.lng}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('mode', 'driving');

    let res: Response;
    try {
      res = await this.fetchFn(url.toString());
    } catch (err) {
      throw new FareEngineError(
        'ROUTING_PROVIDER_UNREACHABLE',
        `Failed to reach Google Directions API: ${(err as Error).message}`,
        503,
      );
    }

    if (!res.ok) {
      throw new FareEngineError(
        'ROUTING_PROVIDER_ERROR',
        `Google Directions API returned HTTP ${res.status}`,
        502,
      );
    }

    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new FareEngineError(
        'ROUTE_NOT_FOUND',
        `Google Directions API status: ${data.status}`,
        422,
      );
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      encodedPolyline: route.overview_polyline.points,
      distanceMeters: leg.distance.value,
      durationSeconds: leg.duration.value,
      provider: 'google',
    };
  }
}

/**
 * Mapbox Directions API implementation (fallback / alternative provider).
 * Requires MAPBOX_ACCESS_TOKEN to be set in the environment.
 */
export class MapboxDirectionsProvider implements RoutingProvider {
  constructor(private accessToken: string, private fetchFn: typeof fetch = fetch) {}

  async getRoute(origin: LatLng, destination: LatLng): Promise<RoutePolyline> {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`);
    url.searchParams.set('access_token', this.accessToken);
    url.searchParams.set('geometries', 'polyline');
    url.searchParams.set('overview', 'full');

    let res: Response;
    try {
      res = await this.fetchFn(url.toString());
    } catch (err) {
      throw new FareEngineError(
        'ROUTING_PROVIDER_UNREACHABLE',
        `Failed to reach Mapbox Directions API: ${(err as Error).message}`,
        503,
      );
    }

    if (!res.ok) {
      throw new FareEngineError(
        'ROUTING_PROVIDER_ERROR',
        `Mapbox Directions API returned HTTP ${res.status}`,
        502,
      );
    }

    const data = await res.json();
    if (!data.routes?.length) {
      throw new FareEngineError('ROUTE_NOT_FOUND', 'Mapbox Directions API returned no routes', 422);
    }

    const route = data.routes[0];

    return {
      encodedPolyline: route.geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      provider: 'mapbox',
    };
  }
}

/**
 * Wraps a primary provider with a fallback. If the primary throws a
 * provider-level error (unreachable/5xx), falls back to the secondary.
 * Routing errors (ROUTE_NOT_FOUND, 4xx from the provider re: invalid coords)
 * are NOT retried on the fallback since they indicate the route itself is
 * the problem.
 */
export class FallbackRoutingProvider implements RoutingProvider {
  constructor(private primary: RoutingProvider, private fallback?: RoutingProvider) {}

  async getRoute(origin: LatLng, destination: LatLng): Promise<RoutePolyline> {
    try {
      return await this.primary.getRoute(origin, destination);
    } catch (err) {
      if (
        err instanceof FareEngineError &&
        this.fallback &&
        ((err as any).code === 'ROUTING_PROVIDER_UNREACHABLE' || (err as any).code === 'ROUTING_PROVIDER_ERROR')
      ) {
        return this.fallback.getRoute(origin, destination);
      }
      throw err;
    }
  }
}

export function metersToKm(meters: number): number {
  return meters / 1000;
}

export function secondsToMinutes(seconds: number): number {
  return seconds / 60;
}
