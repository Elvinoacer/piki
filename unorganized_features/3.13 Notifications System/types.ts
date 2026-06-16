/**
 * Common contract every channel provider implements. Keeps the dispatcher
 * (dispatcher.ts) decoupled from FCM/Africa's Talking/SMTP/etc SDK specifics,
 * and makes providers individually unit-testable / mockable.
 */
export interface SendResult {
  success: boolean;
  /** Provider-specific message/ticket id for tracing (FCM message id, AT messageId, etc.) */
  providerRef?: string;
  /** Present when success=false */
  error?: string;
  /** Set true if the failure is permanent (e.g. invalid token) — caller should not retry */
  permanent?: boolean;
}

export interface PushPayload {
  tokens: string[]; // FCM registration tokens for this user (multi-device)
  title: string;
  body: string;
  data?: Record<string, string>; // deep-link info, tripId, etc (FCM data payload must be string-valued)
}

export interface SmsPayload {
  to: string; // E.164, e.g. +2547XXXXXXXX
  message: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body: string; // plaintext; HTML wrapping handled by provider
}

export interface PushProvider {
  send(payload: PushPayload): Promise<SendResult>;
}

export interface SmsProvider {
  send(payload: SmsPayload): Promise<SendResult>;
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<SendResult>;
}
