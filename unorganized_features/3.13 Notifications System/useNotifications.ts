"use client";

import { useEffect, useRef } from "react";
import { useNotificationStore } from "@/lib/stores/useNotificationStore";

/**
 * Wires the notification system into a client component tree:
 *  1. Fetches the first inbox page + unread count on mount.
 *  2. Subscribes to the user's private realtime channel (Pusher/Ably) for
 *     live IN_APP pushes (matches realtime.ts emitViaPusher/emitViaAbly).
 *  3. Registers the browser/device FCM push token if permission is granted.
 *
 * Mount this once near the app root (e.g. in a top-level ClientProviders
 * component) — it's safe to call multiple times but only the first mount
 * does meaningful work per session due to the ref guard.
 */
export function useNotifications(userId: string | undefined): void {
  const setInbox = useNotificationStore((s) => s.setInbox);
  const setLoading = useNotificationStore((s) => s.setLoading);
  const receiveRealtime = useNotificationStore((s) => s.receiveRealtime);

  const initialized = useRef(false);

  // 1. Initial inbox fetch
  useEffect(() => {
    if (!userId || initialized.current) return;
    initialized.current = true;

    setLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        setInbox(data.items ?? [], data.unreadCount ?? 0, data.nextCursor ?? null);
      })
      .catch((err) => console.error("Failed to load notifications:", err))
      .finally(() => setLoading(false));
  }, [userId, setInbox, setLoading]);

  // 2. Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const provider = process.env.NEXT_PUBLIC_REALTIME_PROVIDER ?? "pusher";
    let cleanup: (() => void) | undefined;

    if (provider === "pusher") {
      cleanup = subscribeViaPusher(userId, receiveRealtime);
    } else if (provider === "ably") {
      cleanup = subscribeViaAbly(userId, receiveRealtime);
    }

    return () => cleanup?.();
  }, [userId, receiveRealtime]);

  // 3. FCM push token registration (web push)
  useEffect(() => {
    if (!userId) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    registerWebPushToken().catch((err) =>
      console.error("FCM web push registration failed:", err),
    );
  }, [userId]);
}

function subscribeViaPusher(
  userId: string,
  onMessage: (payload: any) => void,
): () => void {
  let pusherInstance: any;
  let channel: any;

  import("pusher-js")
    .then(({ default: Pusher }) => {
      const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
      const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "eu";
      if (!key) {
        console.warn("NEXT_PUBLIC_PUSHER_KEY not set — realtime notifications disabled");
        return;
      }

      pusherInstance = new Pusher(key, {
        cluster,
        authEndpoint: "/api/notifications/pusher-auth",
      });
      channel = pusherInstance.subscribe(`private-user-${userId}`);
      channel.bind("notification", onMessage);
    })
    .catch((err) => console.error("Failed to load pusher-js:", err));

  return () => {
    channel?.unbind("notification", onMessage);
    pusherInstance?.unsubscribe(`private-user-${userId}`);
    pusherInstance?.disconnect();
  };
}

function subscribeViaAbly(
  userId: string,
  onMessage: (payload: any) => void,
): () => void {
  let client: any;
  let channel: any;

  import("ably")
    .then(({ default: Ably }) => {
      client = new Ably.Realtime({ authUrl: "/api/notifications/ably-auth" });
      channel = client.channels.get(`user-${userId}`);
      channel.subscribe("notification", (msg: any) => onMessage(msg.data));
    })
    .catch((err) => console.error("Failed to load ably:", err));

  return () => {
    channel?.unsubscribe("notification");
    client?.close();
  };
}

/**
 * Requests Notification permission, gets an FCM token via the Firebase Web
 * SDK, and registers it with the backend. No-ops silently if permission is
 * denied — we don't want to nag riders who declined.
 */
async function registerWebPushToken(): Promise<void> {
  if (Notification.permission === "denied") return;

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const { getMessaging, getToken } = await import("firebase/messaging");
  const { getFirebaseClientApp } = await import("@/lib/firebase-client");

  const messaging = getMessaging(getFirebaseClientApp());
  const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

  const token = await getToken(messaging, { vapidKey });
  if (!token) return;

  await fetch("/api/notifications/push-tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, platform: "web" }),
  });
}
