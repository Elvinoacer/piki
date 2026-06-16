// lib/safety/sms.service.ts
// Wraps Africa's Talking SMS dispatch for safety events.

// @ts-ignore
import AfricasTalking from "africastalking";

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});

const sms = at.SMS;

/**
 * Sends an SMS to multiple recipients.
 * Used for SOS contact alerts and night check-in prompts.
 */
export async function sendSosSmsBatch(phones: string[], message: string) {
  if (phones.length === 0) return;
  return sms.send({ to: phones, message, from: process.env.AT_SENDER_ID });
}

export async function sendCheckInSms(phone: string, checkInId: string) {
  const replyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/check-in/${checkInId}`;
  return sms.send({
    to: [phone],
    message: `🌙 Pikii safety check: Are you safe? Tap to confirm: ${replyUrl}`,
    from: process.env.AT_SENDER_ID,
  });
}
