import "server-only";

/**
 * Thin abstraction over the realtime provider (Pusher Channels or Ably —
 * PRD §4.1 leaves this as a config choice). Swap the implementation inside
 * this file; callers (dispatcher.ts) are unaffected.
 *
 * Client-side subscribes to a private channel `user-{userId}` and listens
 * for the `notification` event — see useNotifications.ts hook.
 */

export interface InAppNotificationPayload {
  id: string;
  title: string;
  body: string;
  event: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export async function emitInAppNotification(
  userId: string,
  payload: InAppNotificationPayload,
): Promise<void> {
  const provider = process.env.REALTIME_PROVIDER ?? "pusher";

  try {
    if (provider === "pusher") {
      await emitViaPusher(userId, payload);
    } else if (provider === "ably") {
      await emitViaAbly(userId, payload);
    } else {
      console.warn(`Unknown REALTIME_PROVIDER="${provider}" — in-app push not emitted`);
    }
  } catch (err) {
    // Realtime emit failure should never fail the parent request — the
    // Notification row is already persisted and will surface on next
    // poll/inbox fetch even if the live push didn't arrive.
    console.error("emitInAppNotification failed:", err);
  }
}

async function emitViaPusher(userId: string, payload: InAppNotificationPayload): Promise<void> {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? "eu";

  if (!appId || !key || !secret) {
    console.warn("Pusher credentials missing — skipping realtime emit");
    return;
  }

  // Lazy import: avoids bundling pusher SDK into non-realtime code paths.
  const Pusher = (await import("pusher")).default;
  const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });

  await pusher.trigger(`private-user-${userId}`, "notification", payload);
}

async function emitViaAbly(userId: string, payload: InAppNotificationPayload): Promise<void> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    console.warn("Ably API key missing — skipping realtime emit");
    return;
  }

  const Ably = (await import("ably")).default;
  const client = new Ably.Rest({ key: apiKey });
  const channel = client.channels.get(`user-${userId}`);

  await new Promise<void>((resolve, reject) => {
    channel.publish("notification", payload, (err) => (err ? reject(err) : resolve()));
  });
}
