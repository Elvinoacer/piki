// src/lib/notification-templates.ts
// Centralised notification copy for every event type.
// English + Swahili versions — pick based on user locale preference.

import type { NotificationType, StatusMessageContext } from "@/types/communication";

export type Lang = "en" | "sw";

interface NotificationTemplate {
  title: string;
  body: string;
}

type Templates = Record<NotificationType, (ctx: StatusMessageContext) => NotificationTemplate>;

// ── English templates ─────────────────────────────────────────────────────────
const en: Templates = {
  TRIP_REQUESTED: (ctx) => ({
    title: "New ride request",
    body: `You have a new ride request nearby. Accept before the timer runs out.`,
  }),
  TRIP_ACCEPTED: (ctx) => ({
    title: "Rider found!",
    body: `${ctx.riderName ?? "Your rider"} has accepted your request and is on the way.`,
  }),
  RIDER_ARRIVING: (ctx) => ({
    title: "Rider is almost there",
    body: `${ctx.riderName ?? "Your rider"} is ${ctx.eta ?? "a few"} minute${ctx.eta === 1 ? "" : "s"} away. Get ready!`,
  }),
  RIDER_ARRIVED: (ctx) => ({
    title: "Rider has arrived",
    body: `${ctx.riderName ?? "Your rider"} is waiting at your pickup point.`,
  }),
  TRIP_STARTED: (ctx) => ({
    title: "Trip started",
    body: `Your trip is underway. Have a safe ride!`,
  }),
  TRIP_COMPLETED: (ctx) => ({
    title: "Trip completed",
    body: `You've arrived. Please rate your experience with ${ctx.riderName ?? "your rider"}.`,
  }),
  TRIP_CANCELLED: (ctx) => ({
    title: "Trip cancelled",
    body: `Your trip was cancelled. Tap to book a new one.`,
  }),
  PAYMENT_RECEIVED: (ctx) => ({
    title: "Payment received",
    body: `Your payment for the trip has been confirmed. Thank you!`,
  }),
  PAYOUT_PROCESSED: (ctx) => ({
    title: "Payout sent",
    body: `Your withdrawal has been sent to your M-Pesa. Check your messages.`,
  }),
  PROMO_AVAILABLE: (ctx) => ({
    title: "You have a promo!",
    body: `A new offer is waiting for you. Tap to see your discount.`,
  }),
  DOCUMENT_EXPIRING: (ctx) => ({
    title: "Document expiring soon",
    body: `One of your compliance documents is expiring. Update it to stay active on Pikii.`,
  }),
  CHAT_MESSAGE: (ctx) => ({
    title: `New message`,
    body: `You have a new message about your trip.`,
  }),
  SYSTEM: (ctx) => ({
    title: "Pikii Update",
    body: `You have a system notification from Pikii.`,
  }),
};

// ── Swahili templates ─────────────────────────────────────────────────────────
const sw: Templates = {
  TRIP_REQUESTED: () => ({
    title: "Ombi jipya la safari",
    body: `Una ombi jipya la safari karibu nawe. Kubali kabla muda haujamalizika.`,
  }),
  TRIP_ACCEPTED: (ctx) => ({
    title: "Dereva amepatikana!",
    body: `${ctx.riderName ?? "Dereva wako"} amekubali ombi lako na anakuja.`,
  }),
  RIDER_ARRIVING: (ctx) => ({
    title: "Dereva anakaribia",
    body: `${ctx.riderName ?? "Dereva wako"} yuko dakika ${ctx.eta ?? "chache"} mbali. Jiandae!`,
  }),
  RIDER_ARRIVED: (ctx) => ({
    title: "Dereva amefika",
    body: `${ctx.riderName ?? "Dereva wako"} anakungoja mahali pa kukuchukua.`,
  }),
  TRIP_STARTED: () => ({
    title: "Safari imeanza",
    body: `Safari yako inaendelea. Safari salama!`,
  }),
  TRIP_COMPLETED: (ctx) => ({
    title: "Safari imekamilika",
    body: `Umefika. Tafadhali tathmini uzoefu wako na ${ctx.riderName ?? "dereva"}.`,
  }),
  TRIP_CANCELLED: () => ({
    title: "Safari imefutwa",
    body: `Safari yako ilifutwa. Gonga kuhifadhi safari mpya.`,
  }),
  PAYMENT_RECEIVED: () => ({
    title: "Malipo yamepokelewa",
    body: `Malipo yako ya safari yamethibitishwa. Asante!`,
  }),
  PAYOUT_PROCESSED: () => ({
    title: "Malipo yametumwa",
    body: `Uondoaji wako umetumwa kwenye M-Pesa yako. Angalia ujumbe wako.`,
  }),
  PROMO_AVAILABLE: () => ({
    title: "Una ofa!",
    body: `Ofa mpya inakungoja. Gonga kuona punguzo lako.`,
  }),
  DOCUMENT_EXPIRING: () => ({
    title: "Hati inakwisha",
    body: `Moja ya hati zako za utiifu inakwisha. Isasishe ili kubaki hai kwenye Pikii.`,
  }),
  CHAT_MESSAGE: () => ({
    title: "Ujumbe mpya",
    body: `Una ujumbe mpya kuhusu safari yako.`,
  }),
  SYSTEM: () => ({
    title: "Taarifa ya Pikii",
    body: `Una taarifa ya mfumo kutoka Pikii.`,
  }),
};

const TEMPLATES: Record<Lang, Templates> = { en, sw };

/**
 * Get the notification title + body for a given event type.
 * @param type  NotificationType
 * @param ctx   Context values interpolated into the message
 * @param lang  "en" | "sw" — defaults to "en"
 */
export function getNotificationTemplate(
  type: NotificationType,
  ctx: StatusMessageContext = {},
  lang: Lang = "en"
): NotificationTemplate {
  const templates = TEMPLATES[lang] ?? TEMPLATES.en;
  return templates[type](ctx);
}
