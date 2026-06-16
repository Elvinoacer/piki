import { NotificationChannel, NotificationEvent } from "@prisma/client";

/**
 * Single source of truth for every notification event in Pikii.
 *
 * - `defaultChannels`: channels enabled out-of-the-box for a new user.
 * - `lockedChannels`: channels the user CANNOT opt out of for this event
 *   (e.g. safety alerts always SMS+push regardless of preference).
 * - `templateKey`: key into the template registry (src/lib/notifications/templates).
 * - `roles`: which user roles this event can apply to (informational, used by
 *   preference UI to avoid showing irrelevant toggles, e.g. PAYOUT_PROCESSED
 *   is rider-only).
 */
export interface NotificationEventConfig {
  templateKey: string;
  defaultChannels: NotificationChannel[];
  lockedChannels: NotificationChannel[];
  roles: Array<"CLIENT" | "RIDER" | "SACCO_ADMIN" | "ADMIN" | "ALL">;
  description: string;
}

export const NOTIFICATION_EVENT_REGISTRY: Record<
  NotificationEvent,
  NotificationEventConfig
> = {
  RIDE_MATCHED: {
    templateKey: "ride_matched",
    defaultChannels: ["PUSH", "IN_APP", "SMS"],
    lockedChannels: [],
    roles: ["CLIENT", "RIDER"],
    description: "A rider has been matched to your trip request.",
  },
  RIDER_ARRIVING: {
    templateKey: "rider_arriving",
    defaultChannels: ["PUSH", "IN_APP"],
    lockedChannels: [],
    roles: ["CLIENT"],
    description: "Your rider is approaching the pickup point.",
  },
  RIDER_ARRIVED: {
    templateKey: "rider_arrived",
    defaultChannels: ["PUSH", "IN_APP", "SMS"],
    lockedChannels: [],
    roles: ["CLIENT"],
    description: "Your rider has arrived at the pickup point.",
  },
  TRIP_STARTED: {
    templateKey: "trip_started",
    defaultChannels: ["PUSH", "IN_APP"],
    lockedChannels: [],
    roles: ["CLIENT", "RIDER"],
    description: "Your trip has started.",
  },
  TRIP_COMPLETED: {
    templateKey: "trip_completed",
    defaultChannels: ["PUSH", "IN_APP", "SMS", "EMAIL"],
    lockedChannels: [],
    roles: ["CLIENT", "RIDER"],
    description: "Your trip has been completed. Receipt available.",
  },
  TRIP_CANCELLED: {
    templateKey: "trip_cancelled",
    defaultChannels: ["PUSH", "IN_APP", "SMS"],
    lockedChannels: [],
    roles: ["CLIENT", "RIDER"],
    description: "A trip was cancelled.",
  },
  PAYMENT_RECEIVED: {
    templateKey: "payment_received",
    defaultChannels: ["PUSH", "IN_APP", "SMS"],
    lockedChannels: ["SMS"], // M-Pesa confirmation SMS is regulatory/expected
    roles: ["CLIENT", "RIDER"],
    description: "Payment for your trip was received.",
  },
  PAYMENT_FAILED: {
    templateKey: "payment_failed",
    defaultChannels: ["PUSH", "IN_APP", "SMS"],
    lockedChannels: ["SMS"],
    roles: ["CLIENT"],
    description: "A payment attempt failed.",
  },
  PAYOUT_PROCESSED: {
    templateKey: "payout_processed",
    defaultChannels: ["PUSH", "IN_APP", "SMS", "EMAIL"],
    lockedChannels: ["SMS"], // financial record — regulatory
    roles: ["RIDER"],
    description: "Your payout/withdrawal has been processed.",
  },
  DOCUMENT_EXPIRING: {
    templateKey: "document_expiring",
    defaultChannels: ["PUSH", "IN_APP", "EMAIL"],
    lockedChannels: [],
    roles: ["RIDER"],
    description: "One of your compliance documents is expiring soon.",
  },
  DOCUMENT_EXPIRED: {
    templateKey: "document_expired",
    defaultChannels: ["PUSH", "IN_APP", "SMS", "EMAIL"],
    lockedChannels: ["IN_APP"], // must surface in-app to block "go online"
    roles: ["RIDER"],
    description: "A compliance document has expired. You may be taken offline.",
  },
  PROMO_AVAILABLE: {
    templateKey: "promo_available",
    defaultChannels: ["PUSH", "IN_APP"],
    lockedChannels: [],
    roles: ["CLIENT", "RIDER"],
    description: "A new promo or referral bonus is available.",
  },
  SOS_TRIGGERED: {
    templateKey: "sos_triggered",
    defaultChannels: ["PUSH", "SMS", "IN_APP"],
    lockedChannels: ["PUSH", "SMS"], // safety-critical — never suppressible
    roles: ["ALL"],
    description: "An SOS alert was triggered on a trip.",
  },
  BROADCAST: {
    templateKey: "broadcast",
    defaultChannels: ["PUSH", "IN_APP"],
    lockedChannels: [],
    roles: ["ALL"],
    description: "Platform-wide announcement from Pikii.",
  },
};

/** Returns true if `channel` cannot be disabled by the user for `event`. */
export function isChannelLocked(
  event: NotificationEvent,
  channel: NotificationChannel,
): boolean {
  return NOTIFICATION_EVENT_REGISTRY[event].lockedChannels.includes(channel);
}

/** Returns the default enabled channels for a freshly-registered user. */
export function getDefaultChannels(
  event: NotificationEvent,
): NotificationChannel[] {
  return NOTIFICATION_EVENT_REGISTRY[event].defaultChannels;
}

export const ALL_CHANNELS: NotificationChannel[] = [
  "PUSH",
  "SMS",
  "IN_APP",
  "EMAIL",
];

export const ALL_EVENTS = Object.keys(
  NOTIFICATION_EVENT_REGISTRY,
) as NotificationEvent[];
