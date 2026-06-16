import "server-only";
import type { EmailPayload, EmailProvider, SendResult } from "./types";

/**
 * Email provider using Resend's HTTP API (no SDK dep required).
 *
 * Required env vars:
 *   RESEND_API_KEY
 *   NOTIFICATIONS_FROM_EMAIL   e.g. "Pikii <notifications@pikii.app>"
 *
 * Swap implementation for SES/Postmark/etc by re-implementing send() —
 * the EmailProvider interface stays the same so dispatcher.ts is unaffected.
 */
export class ResendEmailProvider implements EmailProvider {
  async send(payload: EmailPayload): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.NOTIFICATIONS_FROM_EMAIL;

    if (!apiKey || !from) {
      return {
        success: false,
        error: "Email credentials missing (RESEND_API_KEY / NOTIFICATIONS_FROM_EMAIL)",
      };
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: payload.to,
          subject: payload.subject,
          text: payload.body,
          html: plaintextToHtml(payload.body),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        const permanent = res.status === 422; // invalid recipient address etc.
        return { success: false, error: `Resend HTTP ${res.status}: ${text}`, permanent };
      }

      const json = (await res.json()) as { id: string };
      return { success: true, providerRef: json.id };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown email error",
      };
    }
  }
}

/** Minimal plaintext->HTML wrapper so emails aren't unstyled walls of text. */
function plaintextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="font-weight: 700; font-size: 18px; margin-bottom: 16px;">Pikii</div>
    <div>${escaped}</div>
    <div style="margin-top: 32px; font-size: 12px; color: #999;">
      Manage your notification preferences in the Pikii app under Settings → Notifications.
    </div>
  </body>
</html>`;
}

export const resendEmailProvider = new ResendEmailProvider();
