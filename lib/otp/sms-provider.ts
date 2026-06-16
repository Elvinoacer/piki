import { getEnv } from "@/lib/env";
import type { Locale } from "@/app/generated/prisma/client";

// -------------------------------------------------------------------------------------
// SMS Provider — Africa's Talking
// -------------------------------------------------------------------------------------
// Sends OTP messages via Africa's Talking (per PRD 4.1 — "SMS/USSD: Africa's
// Talking"). The message body is localized (English/Swahili) per 3.1/3.17.
//
// In non-production (`AFRICASTALKING_ENV=sandbox`) without API credentials,
// falls back to logging the OTP to the console — useful for local dev /
// automated tests without burning real SMS credits.
// -------------------------------------------------------------------------------------

const AFRICASTALKING_API_URL = "https://api.africastalking.com/version1/messaging";
const AFRICASTALKING_SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";

function otpMessageBody(code: string, locale: Locale): string {
  if (locale === "SW") {
    return `Nambari yako ya uthibitisho ya Pikii ni ${code}. Haitarajiwi kushirikiwa na mtu yeyote.`;
  }
  return `Your Pikii verification code is ${code}. Do not share this code with anyone.`;
}

/**
 * Sends an OTP SMS to `phone` (E.164). Returns the provider's message ID for
 * audit/troubleshooting, or `null` if running in a local-dev fallback mode.
 */
export async function sendOtpSms(
  phone: string,
  code: string,
  locale: Locale = "EN" as Locale
): Promise<string | null> {
  const env = getEnv();
  const body = otpMessageBody(code, locale);

  if (!env.AFRICASTALKING_API_KEY || !env.AFRICASTALKING_USERNAME) {
    // Local-dev / test fallback — do NOT use this path in production.
    // eslint-disable-next-line no-console
    console.warn(
      `[otp-dev-fallback] Africa's Talking not configured. OTP for ${phone}: ${code}`
    );
    return null;
  }

  const url =
    env.AFRICASTALKING_ENV === "production"
      ? AFRICASTALKING_API_URL
      : AFRICASTALKING_SANDBOX_URL;

  const params = new URLSearchParams({
    username: env.AFRICASTALKING_USERNAME,
    to: phone,
    message: body,
    from: env.AFRICASTALKING_SENDER_ID,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      apiKey: env.AFRICASTALKING_API_KEY,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Africa's Talking SMS send failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
  };

  return json.SMSMessageData?.Recipients?.[0]?.messageId ?? null;
}
