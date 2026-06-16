import "server-only";
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import type { PushPayload, PushProvider, SendResult } from "./types";

/**
 * Firebase Cloud Messaging push provider.
 *
 * Required env vars:
 *   FCM_PROJECT_ID
 *   FCM_CLIENT_EMAIL
 *   FCM_PRIVATE_KEY   (PEM string — escape newlines as \n in .env)
 *
 * NOTE: invalid/unregistered tokens should be pruned from PushToken on
 * permanent failure — see handlePermanentFailures() called by dispatcher.
 */

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FCM credentials missing: set FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY",
    );
  }

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return app;
}

/** Tokens FCM reports as permanently invalid — caller should delete these. */
const PERMANENT_ERROR_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export class FcmPushProvider implements PushProvider {
  async send(payload: PushPayload): Promise<SendResult> {
    if (payload.tokens.length === 0) {
      return { success: false, error: "No push tokens for user", permanent: true };
    }

    try {
      const messaging = getMessaging(getFirebaseApp());

      // sendEachForMulticast handles per-token results so we can prune
      // dead tokens without failing the whole batch.
      const response = await messaging.sendEachForMulticast({
        tokens: payload.tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } },
      });

      const invalidTokens: string[] = [];
      let anySuccess = false;
      let lastError: string | undefined;

      response.responses.forEach((r, i) => {
        if (r.success) {
          anySuccess = true;
        } else {
          lastError = r.error?.message;
          if (r.error && PERMANENT_ERROR_CODES.has(r.error.code)) {
            invalidTokens.push(payload.tokens[i]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        // Caller (dispatcher) is responsible for pruning these from PushToken.
        // We surface them via a side-channel: attach to error string with a
        // recognizable prefix the dispatcher can parse, OR — cleaner —
        // the dispatcher re-derives this by re-checking response codes.
        // For simplicity here we just log; dispatcher prunes separately.
        console.warn("FCM: pruning invalid tokens", invalidTokens);
        await pruneInvalidTokens(invalidTokens);
      }

      if (anySuccess) {
        return { success: true, providerRef: response.responses.find((r) => r.success)?.messageId };
      }

      return {
        success: false,
        error: lastError ?? "All FCM sends failed",
        permanent: invalidTokens.length === payload.tokens.length,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown FCM error",
      };
    }
  }
}

/** Removes stale push tokens so future sends don't keep failing on them. */
async function pruneInvalidTokens(tokens: string[]): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
}

export const fcmPushProvider = new FcmPushProvider();
