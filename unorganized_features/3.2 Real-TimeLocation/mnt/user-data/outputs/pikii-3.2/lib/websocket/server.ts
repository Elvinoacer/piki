/**
 * lib/websocket/server.ts
 *
 * Socket.IO server singleton for Pikii.
 *
 * Room naming conventions:
 *   client:{tripId}       — subscribed by the client for their active trip
 *   rider:{riderId}       — subscribed by the rider for incoming offers & updates
 *   trip:{tripId}         — both client and rider join once matched (shared stream)
 *   admin:ops             — platform operations dashboard
 *
 * Attach to Next.js custom server (server.ts) or a standalone ws process.
 *
 * Usage in API routes / engine:
 *   import { getSocketServer } from "@/lib/websocket/server";
 *   const io = getSocketServer();
 *   io.to("rider:xyz").emit("trip:offer", payload);
 */

import { Server as IOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { verifySocketToken } from "@/lib/websocket/auth";

let _io: IOServer | null = null;

export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (_io) return _io;

  _io = new IOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  // ── Auth middleware ────────────────────────────────────────
  _io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace("Bearer ", "");

    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const user = await verifySocketToken(token);
      socket.data.userId = user.id;
      socket.data.role   = user.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  // ── Connection handler ─────────────────────────────────────
  _io.on("connection", (socket) => {
    const { userId, role } = socket.data as { userId: string; role: string };

    // Auto-join role-based room
    if (role === "RIDER") {
      socket.join(`rider:${userId}`);
    } else if (role === "CLIENT") {
      socket.join(`client:${userId}`);
    } else if (role === "PLATFORM_ADMIN" || role === "SUPPORT_AGENT") {
      socket.join("admin:ops");
    }

    // ── Rider: location update ─────────────────────────────
    socket.on("rider:location", async (payload: {
      lat: number;
      lng: number;
      heading?: number;
      speedKmh?: number;
      accuracy?: number;
      tripId?: string;
    }) => {
      if (role !== "RIDER") return;

      // Dynamic import avoids circular deps
      const { upsertRiderLocation } = await import("@/lib/geo/queries");
      const { RiderStatus }         = await import("@prisma/client");
      const { recordGpsPoint }      = await import("@/lib/geo/queries");

      await upsertRiderLocation({
        riderId:  userId,
        lat:      payload.lat,
        lng:      payload.lng,
        heading:  payload.heading,
        speedKmh: payload.speedKmh,
        accuracy: payload.accuracy,
        isOnline: true,
        status:   RiderStatus.AVAILABLE, // Engine overrides when on trip
      });

      // If rider is on an active trip, broadcast location to client
      if (payload.tripId) {
        socket.to(`trip:${payload.tripId}`).emit("rider:location:update", {
          tripId:   payload.tripId,
          riderId:  userId,
          lat:      payload.lat,
          lng:      payload.lng,
          heading:  payload.heading,
          speedKmh: payload.speedKmh,
          ts:       Date.now(),
        });

        // Persist GPS breadcrumb
        await recordGpsPoint({
          tripId:  payload.tripId,
          riderId: userId,
          lat:     payload.lat,
          lng:     payload.lng,
          heading: payload.heading,
          speedKmh: payload.speedKmh,
        });
      }
    });

    // ── Rider: join shared trip room after acceptance ──────
    socket.on("trip:join", (payload: { tripId: string }) => {
      socket.join(`trip:${payload.tripId}`);
    });

    // ── Client: join trip room ─────────────────────────────
    socket.on("client:trip:join", (payload: { tripId: string }) => {
      if (role !== "CLIENT") return;
      socket.join(`trip:${payload.tripId}`);
      socket.join(`client:${payload.tripId}`); // Also join direct trip channel
    });

    // ── Rider: toggle online/offline ───────────────────────
    socket.on("rider:status", async (payload: { isOnline: boolean }) => {
      if (role !== "RIDER") return;
      const { upsertRiderLocation } = await import("@/lib/geo/queries");
      const { RiderStatus }         = await import("@prisma/client");

      // Fetch last known location
      const { prisma } = await import("@/lib/prisma");
      const loc = await prisma.riderLocation.findUnique({
        where: { riderId: userId },
        select: { latitude: true, longitude: true },
      });

      if (loc) {
        await upsertRiderLocation({
          riderId:  userId,
          lat:      loc.latitude,
          lng:      loc.longitude,
          isOnline: payload.isOnline,
          status:   payload.isOnline ? RiderStatus.AVAILABLE : RiderStatus.OFFLINE,
        });
      }
    });

    // ── Disconnect ─────────────────────────────────────────
    socket.on("disconnect", async () => {
      if (role === "RIDER") {
        const { upsertRiderLocation } = await import("@/lib/geo/queries");
        const { RiderStatus }         = await import("@prisma/client");
        const { prisma }              = await import("@/lib/prisma");

        const loc = await prisma.riderLocation.findUnique({
          where: { riderId: userId },
          select: { latitude: true, longitude: true },
        });

        if (loc) {
          await upsertRiderLocation({
            riderId:  userId,
            lat:      loc.latitude,
            lng:      loc.longitude,
            isOnline: false,
            status:   RiderStatus.OFFLINE,
          });
        }
      }
    });
  });

  console.log("[Socket.IO] Server initialized");
  return _io;
}

export function getSocketServer(): IOServer {
  if (!_io) {
    throw new Error(
      "Socket.IO server not initialized. Call initSocketServer(httpServer) in server.ts first."
    );
  }
  return _io;
}
