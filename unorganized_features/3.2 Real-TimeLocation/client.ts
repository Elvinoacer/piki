/**
 * lib/websocket/client.ts
 *
 * Browser-side Socket.IO client singleton + React hook.
 *
 * Usage:
 *   const { socket, connected } = useSocket();
 *   socket?.emit("rider:location", { lat, lng });
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ─── Singleton ───────────────────────────────────────────────

let _socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (_socket?.connected) return _socket;

  _socket = io(process.env.NEXT_PUBLIC_WS_URL ?? "", {
    auth:       { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  return _socket;
}

// ─── Hook ────────────────────────────────────────────────────

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
}

export function useSocket(): UseSocketReturn {
  const { data: session } = useSession();
  const socketRef          = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;

    const socket = getSocket(session.accessToken as string);
    socketRef.current = socket;

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    // If already connected, sync state
    if (socket.connected) setConnected(true);

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [session?.accessToken]);

  return { socket: socketRef.current, connected };
}

// ─── Typed emit helpers ───────────────────────────────────────

export interface LocationPayload {
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  accuracy?: number;
  tripId?: string;
}

export function emitLocation(socket: Socket, payload: LocationPayload) {
  socket.emit("rider:location", payload);
}

export function emitRiderStatus(socket: Socket, isOnline: boolean) {
  socket.emit("rider:status", { isOnline });
}

export function joinTripRoom(socket: Socket, tripId: string) {
  socket.emit("trip:join", { tripId });
}

export function joinClientTripRoom(socket: Socket, tripId: string) {
  socket.emit("client:trip:join", { tripId });
}
