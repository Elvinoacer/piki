// src/lib/pusher/index.ts
// Exports:
//   pusherServer  — Pusher Node SDK (used in API routes / server actions)
//   pusherClient  — PusherJS browser client (used in React components)
//
// Required env vars:
//   PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
//   NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER

import PusherServer from "pusher";
import PusherClient from "pusher-js";

// ── Server instance (singleton) ───────────────────────────────────────────────
let _pusherServer: PusherServer | null = null;

export function getPusherServer(): PusherServer {
  if (!_pusherServer) {
    _pusherServer = new PusherServer({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return _pusherServer;
}

// ── Client instance (singleton, browser only) ────────────────────────────────
let _pusherClient: PusherClient | null = null;

export function getPusherClient(): PusherClient {
  if (typeof window === "undefined") {
    throw new Error("getPusherClient() must only be called in the browser.");
  }
  if (!_pusherClient) {
    _pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return _pusherClient;
}

// ── Channel name helpers ──────────────────────────────────────────────────────

/** Private chat channel for a trip: private-chat-<tripId> */
export const chatChannel = (tripId: string) => `private-chat-${tripId}`;

/** Private notification channel for a user: private-notify-<userId> */
export const notifyChannel = (userId: string) => `private-notify-${userId}`;

// ── Event name constants ──────────────────────────────────────────────────────
export const PUSHER_EVENTS = {
  NEW_MESSAGE: "new-message",
  MESSAGE_READ: "message-read",
  NEW_NOTIFICATION: "new-notification",
  CHAT_CLOSED: "chat-closed",
} as const;
