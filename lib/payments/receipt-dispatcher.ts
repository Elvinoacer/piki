// lib/payments/receipt-dispatcher.ts
// Triggers receipt generation + delivery (SMS link / email) post-payment

import { generateReceiptNumber } from "./receipt";
import { ReceiptData } from "@/types/payments";

/**
 * Called after any payment completes.
 * Builds receipt data and dispatches via available notification channels.
 */
export async function generateReceiptAndNotify(
  trip: any, // Prisma Trip with relations
  payment: any // Prisma Payment
) {
  const tipAmount = Number(payment.tipAmount ?? 0);
  const tripFare = Number(payment.amount) - tipAmount;
  const commissionAmount = Number(payment.commissionAmount ?? 0);
  const commissionRate = Number(payment.commissionRate ?? 0);

  const receiptData: ReceiptData = {
    receiptNumber: generateReceiptNumber(trip.id),
    tripId: trip.id,
    clientName: trip.client?.name ?? "Client",
    riderName: trip.rider?.name ?? "Rider",
    riderPlate: trip.rider?.riderProfile?.plateNumber ?? "—",
    pickupAddress: trip.pickupAddress,
    dropoffAddress: trip.dropoffAddress,
    tripDate: trip.completedAt ?? trip.createdAt,
    distanceKm: Number(trip.distanceKm ?? 0),
    durationMinutes: trip.durationMinutes ?? 0,
    fareBreakdown: {
      baseFare: tripFare,
      tripFare,
      tip: tipAmount,
      commissionRate,
      commissionAmount,
      riderEarning: Number(payment.riderEarning ?? tripFare),
      total: Number(payment.amount),
    },
    paymentMethod: payment.method,
    mpesaReceiptNumber: payment.mpesaReceiptNumber ?? undefined,
  };

  const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/receipts/${trip.id}`;

  // SMS receipt link via Africa's Talking
  const clientPhone = trip.client?.phone;
  if (clientPhone) {
    await sendSmsReceiptLink(clientPhone, receiptUrl, receiptData).catch((e) =>
      console.error("[receipt-dispatcher] SMS send failed:", e)
    );
  }

  // Email if available
  const clientEmail = trip.client?.email;
  if (clientEmail) {
    await sendEmailReceipt(clientEmail, receiptData, receiptUrl).catch((e) =>
      console.error("[receipt-dispatcher] Email send failed:", e)
    );
  }
}

// ----------------------------------------------------------------
// SMS — Africa's Talking
// ----------------------------------------------------------------
async function sendSmsReceiptLink(
  phone: string,
  receiptUrl: string,
  data: ReceiptData
) {
  const message =
    `Pikii Receipt: KES ${data.fareBreakdown.total.toFixed(0)} paid for your ride. ` +
    `View receipt: ${receiptUrl}`;

  const res = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: {
      Accept: "application/json",
      apiKey: process.env.AFRICASTALKING_API_KEY!,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: process.env.AFRICASTALKING_USERNAME!,
      to: phone,
      message,
      from: process.env.AFRICASTALKING_SENDER_ID ?? "Pikii",
    }),
  });

  if (!res.ok) {
    throw new Error(`AT SMS failed: ${res.status} ${await res.text()}`);
  }
}

// ----------------------------------------------------------------
// Email — simple REST to your email provider (Resend / Postmark / SES)
// ----------------------------------------------------------------
async function sendEmailReceipt(
  email: string,
  data: ReceiptData,
  receiptUrl: string
) {
  // Using Resend (https://resend.com) — swap for your provider
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Pikii Receipts <receipts@pikii.co.ke>",
      to: [email],
      subject: `Your Pikii receipt — KES ${data.fareBreakdown.total.toFixed(0)}`,
      html: buildReceiptEmailHtml(data, receiptUrl),
    }),
  });

  if (!res.ok) {
    throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  }
}

function buildReceiptEmailHtml(data: ReceiptData, receiptUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color:#1a1a2e;">Pikii — Trip Receipt</h2>
  <p style="color:#555;">Receipt No: <strong>${data.receiptNumber}</strong></p>
  <hr style="border: 1px solid #eee;" />
  <table style="width:100%; border-collapse:collapse;">
    <tr><td style="padding:6px 0; color:#777;">Rider</td><td style="text-align:right; font-weight:bold;">${data.riderName}</td></tr>
    <tr><td style="padding:6px 0; color:#777;">From</td><td style="text-align:right;">${data.pickupAddress}</td></tr>
    <tr><td style="padding:6px 0; color:#777;">To</td><td style="text-align:right;">${data.dropoffAddress}</td></tr>
    <tr><td style="padding:6px 0; color:#777;">Distance</td><td style="text-align:right;">${data.distanceKm.toFixed(1)} km</td></tr>
    <tr><td style="padding:6px 0; color:#777;">Fare</td><td style="text-align:right;">KES ${data.fareBreakdown.tripFare.toFixed(2)}</td></tr>
    ${data.fareBreakdown.tip > 0 ? `<tr><td style="padding:6px 0; color:#777;">Tip</td><td style="text-align:right;">KES ${data.fareBreakdown.tip.toFixed(2)}</td></tr>` : ""}
    <tr style="border-top:2px solid #eee;">
      <td style="padding:10px 0; font-weight:bold; font-size:16px;">Total</td>
      <td style="text-align:right; font-weight:bold; font-size:16px; color:#1a1a2e;">KES ${data.fareBreakdown.total.toFixed(2)}</td>
    </tr>
    <tr><td style="padding:6px 0; color:#777;">Payment</td><td style="text-align:right;">${data.paymentMethod}${data.mpesaReceiptNumber ? ` (${data.mpesaReceiptNumber})` : ""}</td></tr>
  </table>
  <br />
  <a href="${receiptUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Download PDF Receipt</a>
  <p style="color:#999; font-size:12px; margin-top:24px;">Pikii Ride & Delivery | support@pikii.co.ke</p>
</body>
</html>
  `.trim();
}
