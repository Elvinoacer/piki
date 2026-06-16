// src/lib/africastalking/index.ts
// Wraps Africa's Talking SDK for:
//   - SMS delivery (fallback + status notifications)
//   - Number masking for in-app calls (optional)
//
// Required env vars:
//   AT_API_KEY        — Africa's Talking API key
//   AT_USERNAME       — Africa's Talking username (use "sandbox" for dev)
//   AT_SENDER_ID      — Alphanumeric sender ID e.g. "PIKII" (optional, AT default used if absent)
//   AT_MASK_FROM      — Masking phone number (for call masking, optional feature)

import AfricasTalking from "africastalking";

// ── SDK init ──────────────────────────────────────────────────────────────────
let _at: ReturnType<typeof AfricasTalking> | null = null;

function getAT() {
  if (!_at) {
    _at = AfricasTalking({
      apiKey: process.env.AT_API_KEY!,
      username: process.env.AT_USERNAME!,
    });
  }
  return _at;
}

// ── SMS ───────────────────────────────────────────────────────────────────────

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an SMS to one or more Kenyan numbers.
 * Numbers should be in international format: +2547XXXXXXXX
 */
export async function sendSMS(to: string | string[], message: string): Promise<SMSResult> {
  try {
    const sms = getAT().SMS;
    const recipients = Array.isArray(to) ? to : [to];

    const response = await sms.send({
      to: recipients,
      message,
      from: process.env.AT_SENDER_ID || undefined,
    });

    const first = response.SMSMessageData?.Recipients?.[0];
    if (first?.statusCode === 101) {
      return { success: true, messageId: first.messageId };
    }

    return {
      success: false,
      error: first?.status || "Unknown AT error",
    };
  } catch (err) {
    console.error("[AT SMS] Error:", err);
    return { success: false, error: String(err) };
  }
}

// ── Number masking (voice) ────────────────────────────────────────────────────
// Africa's Talking "Voice" product supports masked calling via a session URL.
// The flow: client dials AT masking number → AT bridges to rider's real number.
// This returns the masked number to display in-app for the duration of the trip.

export interface MaskingSession {
  maskedNumber: string; // the number the user dials
  sessionId: string;
}

/**
 * Initiate a masked call session between two parties.
 * Both phone numbers remain hidden from each other.
 * NOTE: This requires the AT Voice product to be enabled on your account.
 */
export async function createMaskedCallSession(
  callerPhone: string,
  calleePhone: string,
  durationMinutes = 15
): Promise<MaskingSession | null> {
  try {
    const voice = getAT().VOICE;

    // AT voice masking: make outbound call that bridges both parties
    // The masking number comes from your AT virtual number pool
    const callResponse = await voice.call({
      callFrom: process.env.AT_MASK_FROM!,
      callTo: [callerPhone, calleePhone],
    });

    // AT returns the masking number / session info in the response
    // Shape varies — adapt to actual AT Voice response schema
    const sessionId = (callResponse as unknown as { sessionId?: string })?.sessionId || cuid();
    return {
      maskedNumber: process.env.AT_MASK_FROM!,
      sessionId,
    };
  } catch (err) {
    console.error("[AT Voice Mask] Error:", err);
    return null;
  }
}

function cuid() {
  return Math.random().toString(36).slice(2);
}
