"use client";
// components/rider/useRiderSocket.ts
// WebSocket hook for real-time incoming requests and trip status updates — PRD §4.3
// Compatible with Pusher Channels, Ably, or Socket.IO (swap provider in lib/pusher.ts)

import { useEffect, useCallback } from "react";
import { useRiderDashboardStore } from "@/store/riderDashboardStore";
import type { ActiveTrip } from "@/store/riderDashboardStore";
import type { IncomingRequest } from "@/types/rider-dashboard";

// ─── Pusher-flavoured integration ────────────────────────────────────────────
// If using Ably or Socket.IO, swap the channel/event bindings below.
// The store interface stays the same regardless of provider.

interface PusherChannel {
  bind: (event: string, callback: (data: unknown) => void) => void;
  unbind_all: () => void;
}

interface PusherClient {
  subscribe: (channelName: string) => PusherChannel;
  unsubscribe: (channelName: string) => void;
}

// Import your initialised Pusher/Ably client from lib/pusher.ts
// import { pusherClient } from '@/lib/pusher'

export function useRiderSocket(riderId: string | undefined) {
  const {
    riderStatus,
    setIncomingRequest,
    setActiveTrip,
    setRiderStatus,
    setEarnings,
    setWallet,
  } = useRiderDashboardStore();

  const handleIncomingRequest = useCallback(
    (data: unknown) => {
      const req = data as IncomingRequest;
      if (riderStatus !== "AVAILABLE") return; // guard: only accept when available
      setIncomingRequest(req);
    },
    [riderStatus, setIncomingRequest]
  );

  const handleRequestCancelled = useCallback(
    (data: unknown) => {
      const { requestId } = data as { requestId: string };
      const current = useRiderDashboardStore.getState().incomingRequest;
      if (current?.id === requestId) {
        setIncomingRequest(null);
      }
    },
    [setIncomingRequest]
  );

  const handleTripUpdate = useCallback(
    (data: unknown) => {
      const { trip, status } = data as {
        trip: ActiveTrip;
        status: string;
      };
      setActiveTrip(trip);
      if (status === "COMPLETED" || status === "CANCELLED") {
        setActiveTrip(null);
        setRiderStatus("AVAILABLE");
        // Refresh earnings after trip completes
        fetch("/api/rider/earnings")
          .then((r) => r.json())
          .then((res) => {
            if (res.earnings) setEarnings(res.earnings);
            if (res.wallet) setWallet(res.wallet);
          })
          .catch(console.error);
      }
    },
    [setActiveTrip, setRiderStatus, setEarnings, setWallet]
  );

  useEffect(() => {
    if (!riderId) return;

    // ── Pusher Channels ──────────────────────────────────────────────────────
    // Uncomment and adapt when your Pusher client is wired up:
    //
    // const channel = pusherClient.subscribe(`private-rider.${riderId}`)
    // channel.bind('incoming-request',    handleIncomingRequest)
    // channel.bind('request-cancelled',   handleRequestCancelled)
    // channel.bind('trip-update',         handleTripUpdate)
    //
    // return () => {
    //   channel.unbind_all()
    //   pusherClient.unsubscribe(`private-rider.${riderId}`)
    // }

    // ── Socket.IO fallback ───────────────────────────────────────────────────
    // import { io } from 'socket.io-client'
    // const socket = io('/rider', { auth: { riderId } })
    // socket.on('incoming-request', handleIncomingRequest)
    // socket.on('request-cancelled', handleRequestCancelled)
    // socket.on('trip-update', handleTripUpdate)
    // return () => { socket.disconnect() }

    // ── STUB: remove when real socket client is connected ────────────────────
    console.info(`[useRiderSocket] Socket ready for rider ${riderId}`);
  }, [riderId, handleIncomingRequest, handleRequestCancelled, handleTripUpdate]);
}
