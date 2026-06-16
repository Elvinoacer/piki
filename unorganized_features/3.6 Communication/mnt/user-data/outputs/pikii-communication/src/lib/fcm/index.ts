// src/lib/fcm/index.ts
// Firebase Cloud Messaging (Admin SDK) — server-side push dispatch
//
// Required env vars:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (PEM key — use JSON.parse on multiline)

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging, type Message } from "firebase-admin/messaging";

// ── Firebase Admin init (singleton) ──────────────────────────────────────────
function getFirebaseApp(): App {
  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Handle escaped newlines from env
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

// ── Push helpers ──────────────────────────────────────────────────────────────

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>; // FCM data must be string values
  imageUrl?: string;
}

/**
 * Send a single push notification to one device token.
 */
export async function sendPush(payload: PushPayload): Promise<PushResult> {
  try {
    const app = getFirebaseApp();
    const messaging = getMessaging(app);

    const message: Message = {
      token: payload.token,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const messageId = await messaging.send(message);
    return { success: true, messageId };
  } catch (err) {
    console.error("[FCM] Push error:", err);
    return { success: false, error: String(err) };
  }
}

/**
 * Send the same notification to multiple device tokens (up to 500 per batch).
 */
export async function sendPushBatch(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

  const app = getFirebaseApp();
  const messaging = getMessaging(app);

  const messages: Message[] = tokens.map((token) => ({
    token,
    notification: { title, body },
    data,
    android: { priority: "high" as const },
  }));

  const batchResponse = await messaging.sendEach(messages);
  return {
    successCount: batchResponse.successCount,
    failureCount: batchResponse.failureCount,
  };
}
