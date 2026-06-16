/**
 * stores/useRiderLocationBroadcast.ts
 *
 * Hook for RIDER app:
 *   1. Watches device GPS via geolocation.watchPosition
 *   2. Emits location to Socket.IO (real-time)
 *   3. Falls back to offline queue when WS is disconnected
 *   4. Flushes offline queue via REST PUT /api/location on reconnect
 *
 * Usage (in rider dashboard layout):
 *   useRiderLocationBroadcast({ tripId: activeTrip?.id });
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useLocationStore } from "@/stores/useLocationStore";
import { useSocket, emitLocation } from "@/lib/websocket/client";

const EMIT_INTERVAL_MS = 3_000; // Emit every 3 seconds max (throttle)

interface Options {
  tripId?: string; // Current active trip (if any)
  enabled?: boolean;
}

export function useRiderLocationBroadcast({
  tripId,
  enabled = true,
}: Options = {}) {
  const { socket, connected } = useSocket();
  const {
    isOnline,
    setPosition,
    setPermission,
    setWatchId,
    watchId,
    enqueueLocation,
    flushQueue,
  } = useLocationStore();

  const lastEmitRef = useRef<number>(0);
  const flushingRef = useRef(false);

  // ── Flush offline queue via REST when WS reconnects ─────────
  const flushOfflineQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;

    const points = flushQueue();
    if (points.length === 0) {
      flushingRef.current = false;
      return;
    }

    try {
      await fetch("/api/location", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ points }),
      });
    } catch (err) {
      console.warn("[LocationBroadcast] Failed to flush queue:", err);
      // Re-queue if flush failed
      points.forEach((p) => enqueueLocation(p));
    } finally {
      flushingRef.current = false;
    }
  }, [flushQueue, enqueueLocation]);

  // ── Flush on WS reconnect ────────────────────────────────────
  useEffect(() => {
    if (connected) {
      flushOfflineQueue();
    }
  }, [connected, flushOfflineQueue]);

  // ── GPS watcher ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isOnline) {
      // Stop watching if rider goes offline
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setPermission(false);
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission(true);

        const now = Date.now();
        const point = {
          lat:      pos.coords.latitude,
          lng:      pos.coords.longitude,
          heading:  pos.coords.heading    ?? undefined,
          speedKmh: pos.coords.speed
            ? pos.coords.speed * 3.6       // m/s → km/h
            : undefined,
          accuracy: pos.coords.accuracy,
          ts:       now,
          tripId,
        };

        setPosition(point);

        const elapsed = now - lastEmitRef.current;

        if (connected && socket && elapsed >= EMIT_INTERVAL_MS) {
          // WebSocket is live — emit directly
          emitLocation(socket, point);
          lastEmitRef.current = now;
        } else if (!connected) {
          // WS down — buffer for later flush
          enqueueLocation(point);
        }
      },
      (err) => {
        console.warn("[LocationBroadcast] GPS error:", err.message);
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setPermission(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout:            10_000,
        maximumAge:         2_000,
      }
    );

    setWatchId(id);

    return () => {
      navigator.geolocation.clearWatch(id);
      setWatchId(null);
    };
  }, [
    enabled,
    isOnline,
    connected,
    socket,
    tripId,
    setPosition,
    setPermission,
    setWatchId,
    watchId,
    enqueueLocation,
  ]);
}
