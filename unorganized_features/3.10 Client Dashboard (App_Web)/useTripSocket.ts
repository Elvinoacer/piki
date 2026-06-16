"use client";

import { useEffect, useRef } from "react";
import { useTripStore } from "@/stores/trip.store";
import type { ActiveRiderLocation, TripStatus } from "@/types/client-dashboard";

// ─── Message Types ────────────────────────────────────────────────────────────

type WsMessageType =
  | "RIDER_LOCATION"
  | "TRIP_STATUS"
  | "ETA_UPDATE"
  | "TRIP_COMPLETED"
  | "TRIP_CANCELLED";

interface WsMessage {
  type: WsMessageType;
  payload: Record<string, unknown>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Connects to the WebSocket channel for a given trip.
 * Closes and re-opens on tripId change; cleans up on unmount.
 *
 * Using a raw `ws` URL here — swap for Pusher / Ably bindings if needed.
 * The server should push messages matching WsMessage shape.
 */
export function useTripSocket(tripId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const { updateRiderLocation, updateTripStatus, updateEta, triggerRating } =
    useTripStore();

  useEffect(() => {
    if (!tripId) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/trips/${tripId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(event.data) as WsMessage;
      } catch {
        return;
      }

      switch (msg.type) {
        case "RIDER_LOCATION":
          updateRiderLocation(msg.payload as ActiveRiderLocation);
          break;

        case "TRIP_STATUS":
          updateTripStatus(msg.payload.status as TripStatus);
          break;

        case "ETA_UPDATE":
          updateEta(msg.payload.etaMinutes as number);
          break;

        case "TRIP_COMPLETED":
          updateTripStatus("COMPLETED");
          triggerRating(tripId);
          break;

        case "TRIP_CANCELLED":
          updateTripStatus("CANCELLED");
          break;
      }
    };

    ws.onerror = (err) => {
      console.error("[TripSocket] error", err);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [tripId, updateRiderLocation, updateTripStatus, updateEta, triggerRating]);

  return wsRef;
}
