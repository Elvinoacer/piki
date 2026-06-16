import "server-only";
import type { SmsPayload, SmsProvider, SendResult } from "./types";

/**
 * Africa's Talking SMS provider.
 *
 * Required env vars:
 *   AT_USERNAME       (your AT username, "sandbox" for sandbox env)
 *   AT_API_KEY
 *   AT_SENDER_ID      (registered short code / alphanumeric sender id, e.g. "PIKII")
 *
 * Uses the bulk SMS REST endpoint directly (no SDK dependency) so this file
 * has zero extra deps and is trivial to mock in tests.
 * Docs: https://developers.africastalking.com/docs/sms/sending
 */

const AT_BASE_URL = process.env.AT_USERNAME === "sandbox"
  ? "https://api.sandbox.africastalking.com/version1/messaging"
  : "https://api.africastalking.com/version1/messaging";

interface AtRecipient {
  statusCode: number;
  number: string;
  status: string; // "Success" | error description
  cost?: string;
  messageId?: string;
}

interface AtResponse {
  SMSMessageData: {
    Message: string;
    Recipients: AtRecipient[];
  };
}

/** Phone numbers we should never retry SMS to (e.g. invalid format reported by AT). */
const PERMANENT_FAILURE_PATTERNS = [
  "InvalidPhoneNumber",
  "UnsupportedNumberType",
  "InvalidSenderId",
];

export class AfricasTalkingSmsProvider implements SmsProvider {
  async send(payload: SmsPayload): Promise<SendResult> {
    const username = process.env.AT_USERNAME;
    const apiKey = process.env.AT_API_KEY;
    const senderId = process.env.AT_SENDER_ID;

    if (!username || !apiKey) {
      return {
        success: false,
        error: "Africa's Talking credentials missing (AT_USERNAME / AT_API_KEY)",
      };
    }

    try {
      const body = new URLSearchParams({
        username,
        to: normalizeToE164(payload.to),
        message: payload.message,
        ...(senderId ? { from: senderId } : {}),
      });

      const res = await fetch(AT_BASE_URL, {
        method: "POST",
        headers: {
          apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      if (!res.ok) {
        return { success: false, error: `AT HTTP ${res.status}: ${await res.text()}` };
      }

      const json = (await res.json()) as AtResponse;
      const recipient = json.SMSMessageData.Recipients[0];

      if (!recipient) {
        return { success: false, error: "AT returned no recipients" };
      }

      if (recipient.status === "Success" || recipient.statusCode === 101) {
        return { success: true, providerRef: recipient.messageId };
      }

      const permanent = PERMANENT_FAILURE_PATTERNS.some((p) =>
        recipient.status.includes(p),
      );

      return { success: false, error: recipient.status, permanent };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Africa's Talking error",
      };
    }
  }
}

/** Ensures Kenyan numbers are in +254XXXXXXXXX format expected by AT. */
export function normalizeToE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("254")) return `+${digits}`;
  return `+254${digits}`;
}

export const africasTalkingSmsProvider = new AfricasTalkingSmsProvider();
