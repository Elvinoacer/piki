// src/types/communication.ts

export type MessageType = "TEXT" | "IMAGE" | "SYSTEM";
export type NotificationType =
  | "TRIP_REQUESTED"
  | "TRIP_ACCEPTED"
  | "RIDER_ARRIVING"
  | "RIDER_ARRIVED"
  | "TRIP_STARTED"
  | "TRIP_COMPLETED"
  | "TRIP_CANCELLED"
  | "PAYMENT_RECEIVED"
  | "PAYOUT_PROCESSED"
  | "PROMO_AVAILABLE"
  | "DOCUMENT_EXPIRING"
  | "CHAT_MESSAGE"
  | "SYSTEM";

export type NotificationChannel = "PUSH" | "SMS" | "IN_APP";

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string; // masked display name: "Rider" or "Client"
  body: string;
  type: MessageType;
  readAt: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatRoom {
  id: string;
  tripId: string;
  isActive: boolean;
  messages: ChatMessage[];
  createdAt: string;
}

export interface SendMessagePayload {
  body: string;
  type?: MessageType;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface SendNotificationPayload {
  userId: string;
  type: NotificationType;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  typeOverrides: Partial<Record<NotificationType, Partial<Record<NotificationChannel, boolean>>>>;
  fcmToken?: string;
}

// ── Pusher event shapes ───────────────────────────────────────────────────────

export interface PusherChatEvent {
  message: ChatMessage;
}

export interface PusherNotificationEvent {
  notification: NotificationRecord;
}

// ── Automated status message templates ───────────────────────────────────────

export interface StatusMessageContext {
  riderName?: string;
  clientName?: string;
  eta?: number; // minutes
  tripId?: string;
}
