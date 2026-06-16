/**
 * stores/useTripSocket.ts
 *
 * Hook that subscribes to all trip-related WebSocket events
 * and syncs them into the Zustand trip store.
 *
 * Mount this in the trip tracking page / layout for both client and rider.
 *
 * Usage:
 *   useTripSocket({ tripId: "cuid...", role: "CLIENT" });
 */

"use client";

import { useEffect } from "react";
import { useSocket, joinClientTripRoom, joinTripRoom } from "@/lib/websocket/client";
import { useTripStore } from "@/stores/useTripStore";
import { TripStatus } from "@prisma/client";
import type { RiderPosition } from "@/stores/useTripStore";

interface Options {
  tripId: string | undefined;
  role: "CLIENT" | "RIDER";
}

export function useTripSocket({ tripId, role }: Options) {
  const { socket, connected } = useSocket();
  const {
    updateStatus,
    updateRiderPosition,
    setSearching,
    clearTrip,
  } = useTripStore();

  // ── Join rooms when socket connects ──────────────────────────
  useEffect(() => {
    if (!socket || !connected || !tripId) return;

    if (role === "CLIENT") {
      joinClientTripRoom(socket, tripId);
    } else if (role === "RIDER") {
      joinTripRoom(socket, tripId);
    }
  }, [socket, connected, tripId, role]);

  // ── Subscribe to events ──────────────────────────────────────
  useEffect(() => {
    if (!socket || !tripId) return;

    // Client: matching engine broadcasting
    const onSearching = (data: { tripId: string; radiusKm: number; ridersFound?: number }) => {
      if (data.tripId !== tripId) return;
      setSearching(true, data.radiusKm, data.ridersFound);
    };

    // Trip accepted by a rider
    const onAccepted = (data: { tripId: string; riderId: string }) => {
      if (data.tripId !== tripId) return;
      setSearching(false);
      updateStatus(TripStatus.ACCEPTED, { riderId: data.riderId });
    };

    // Generic status update (arriving, arrived, in-progress, completed, cancelled)
    const onStatusUpdate = (data: { tripId: string; status: TripStatus }) => {
      if (data.tripId !== tripId) return;
      updateStatus(data.status);
    };

    // Live rider location stream (for client map)
    const onRiderLocation = (data: {
      tripId: string;
      riderId: string;
      lat: number;
      lng: number;
      heading?: number;
      speedKmh?: number;
      ts: number;
    }) => {
      if (data.tripId !== tripId) return;
      const pos: RiderPosition = {
        lat:      data.lat,
        lng:      data.lng,
        heading:  data.heading,
        speedKmh: data.speedKmh,
        ts:       data.ts,
      };
      updateRiderPosition(pos);
    };

    // Trip expired (no rider found)
    const onExpired = (data: { tripId: string }) => {
      if (data.tripId !== tripId) return;
      updateStatus(TripStatus.EXPIRED);
      setSearching(false);
    };

    // Trip completed
    const onCompleted = (data: { tripId: string }) => {
      if (data.tripId !== tripId) return;
      updateStatus(TripStatus.COMPLETED);
    };

    socket.on("trip:searching",          onSearching);
    socket.on("trip:accepted",           onAccepted);
    socket.on("trip:status:update",      onStatusUpdate);
    socket.on("rider:location:update",   onRiderLocation);
    socket.on("trip:expired",            onExpired);
    socket.on("trip:completed",          onCompleted);

    return () => {
      socket.off("trip:searching",        onSearching);
      socket.off("trip:accepted",         onAccepted);
      socket.off("trip:status:update",    onStatusUpdate);
      socket.off("rider:location:update", onRiderLocation);
      socket.off("trip:expired",          onExpired);
      socket.off("trip:completed",        onCompleted);
    };
  }, [socket, tripId, updateStatus, updateRiderPosition, setSearching, clearTrip]);
}
