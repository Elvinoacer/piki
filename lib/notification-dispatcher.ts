// src/lib/notification-dispatcher.ts
// The single entry-point for sending any notification in Pikii.
// Call this from trip status transitions, payment hooks, background jobs, etc.
//
// Responsibilities:
//   1. Resolve user notification preferences from DB
//   2. Build the message from templates (EN/SW per user pref)
//   3. Persist an in-app Notification record
//   4. Fan out to enabled channels: PUSH (FCM), SMS (AT), real-time (Pusher)
//   5. Update the Notification record with delivery status

import { prisma } from "@/lib/prisma"; // your existing prisma client
import { sendPush } from "@/lib/fcm";
import { sendSMS } from "@/lib/africastalking";
import { getPusherServer, notifyChannel, PUSHER_EVENTS } from "@/lib/pusher";
import { getNotificationTemplate } from "@/lib/notification-templates";
import type {
  NotificationType,
  NotificationChannel,
  SendNotificationPayload,
  StatusMessageContext,
} from "@/types/communication";

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function dispatchNotification(
  payload: SendNotificationPayload & { ctx?: StatusMessageContext }
): Promise<void> {
  const { userId, type, channels, data, ctx = {} } = payload;

  // 1. Fetch user + preferences in one query
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { notificationPreference: true },
  });

  if (!user) {
    console.warn(`[notify] User ${userId} not found — skipping.`);
    return;
  }

  const prefs = user.notificationPreference;
  const lang = (user as unknown as { lang?: string }).lang === "sw" ? "sw" : "en";
  const template = getNotificationTemplate(type, ctx, lang);

  // 2. Determine which channels to actually send to
  const requestedChannels: NotificationChannel[] =
    channels ?? ["PUSH", "SMS", "IN_APP"];

  const activeChannels = requestedChannels.filter((ch) => {
    if (!prefs) return true; // if no prefs saved, default to all on
    // Global channel opt-ins
    if (ch === "PUSH" && !prefs.pushEnabled) return false;
    if (ch === "SMS" && !prefs.smsEnabled) return false;
    if (ch === "IN_APP" && !prefs.inAppEnabled) return false;
    // Per-type overrides
    const overrides = (prefs.typeOverrides as Record<string, Record<string, boolean>> | null) ?? {};
    if (overrides[type]?.[ch] === false) return false;
    return true;
  });

  // 3. For each channel, persist a Notification record + dispatch
  await Promise.allSettled(
    activeChannels.map((channel) =>
      sendToChannel({
        userId,
        type,
        channel,
        title: template.title,
        body: template.body,
        data: data ?? null,
        fcmToken: prefs?.fcmToken ?? null,
        phone: (user as unknown as { phone?: string }).phone ?? null,
      })
    )
  );
}

// ── Per-channel send ──────────────────────────────────────────────────────────

interface ChannelSendArgs {
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  fcmToken: string | null;
  phone: string | null;
}

async function sendToChannel(args: ChannelSendArgs): Promise<void> {
  const { userId, type, channel, title, body, data, fcmToken, phone } = args;

  // Create DB record first (so we have an ID for updating delivery status)
  const record = await prisma.notification.create({
    data: {
      userId,
      type,
      channel,
      title,
      body,
      data: data ?? undefined,
    },
  });

  try {
    let externalId: string | undefined;

    switch (channel) {
      case "PUSH": {
        if (!fcmToken) {
          console.warn(`[notify] No FCM token for user ${userId} — skipping PUSH`);
          return;
        }
        const result = await sendPush({
          token: fcmToken,
          title,
          body,
          data: dataToStringRecord(data),
        });
        if (!result.success) throw new Error(result.error);
        externalId = result.messageId;
        break;
      }

      case "SMS": {
        if (!phone) {
          console.warn(`[notify] No phone for user ${userId} — skipping SMS`);
          return;
        }
        const result = await sendSMS(phone, `${title}: ${body}`);
        if (!result.success) throw new Error(result.error);
        externalId = result.messageId;
        break;
      }

      case "IN_APP": {
        // Real-time push to user's private Pusher channel
        await getPusherServer().trigger(
          notifyChannel(userId),
          PUSHER_EVENTS.NEW_NOTIFICATION,
          {
            notification: {
              id: record.id,
              userId,
              type,
              channel,
              title,
              body,
              data,
              readAt: null,
              createdAt: record.createdAt.toISOString(),
            },
          }
        );
        break;
      }
    }

    // Mark as sent
    await prisma.notification.update({
      where: { id: record.id },
      data: { sentAt: new Date(), externalId },
    });
  } catch (err) {
    console.error(`[notify] Channel ${channel} failed for user ${userId}:`, err);
    await prisma.notification.update({
      where: { id: record.id },
      data: { failedAt: new Date(), failReason: String(err) },
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dataToStringRecord(
  data: Record<string, unknown> | null
): Record<string, string> | undefined {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
}
