// lib/receipt-generator.ts
// Feature 3.14 — Search, History & Receipts
// Generates a PDF receipt for a trip and uploads to S3/R2.
//
// Requires: npm install pdfkit @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

import PDFDocument from "pdfkit";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import type { TripHistoryItem } from "@/types/history";

// ── S3/R2 config (set in .env) ────────────────────────────────
const s3 = new S3Client({
  region: process.env.S3_REGION ?? "auto",
  endpoint: process.env.S3_ENDPOINT,           // Cloudflare R2: https://<accountid>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_RECEIPTS_BUCKET ?? "pikii-receipts";
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Generate a PDF receipt for a completed trip, upload to S3/R2,
 * update the Trip record with receiptUrl, and return a signed URL.
 */
export async function generateAndStoreReceipt(
  trip: TripHistoryItem,
  clientName: string
): Promise<string> {
  // 1. Build PDF in memory
  const pdfBuffer = await buildReceiptPDF(trip, clientName);

  // 2. Upload to S3/R2
  const key = `receipts/${trip.id}.pdf`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
      ContentDisposition: `attachment; filename="pikii-receipt-${trip.id}.pdf"`,
      Metadata: {
        tripId: trip.id,
        generatedAt: new Date().toISOString(),
      },
    })
  );

  // 3. Generate signed URL (expires in 7 days)
  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: SIGNED_URL_TTL }
  );

  // 4. Persist to DB (store the key, not the expiring URL)
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      receiptUrl: key,          // store S3 key; sign on demand
      receiptSentAt: new Date(),
    },
  });

  return signedUrl;
}

/**
 * Get (or generate) a short-lived signed URL for an existing receipt.
 */
export async function getReceiptSignedUrl(tripId: string): Promise<string | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { receiptUrl: true },
  });

  if (!trip?.receiptUrl) return null;

  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: trip.receiptUrl }),
    { expiresIn: SIGNED_URL_TTL }
  );

  return signedUrl;
}

// ── PDF builder ───────────────────────────────────────────────
async function buildReceiptPDF(
  trip: TripHistoryItem,
  clientName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const primaryColor = "#1A73E8";
    const mutedColor = "#6B7280";
    const lineColor = "#E5E7EB";

    // ── Header ───────────────────────────────────────────────
    doc
      .fontSize(24)
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .text("Pikii", 50, 50);

    doc
      .fontSize(10)
      .fillColor(mutedColor)
      .font("Helvetica")
      .text("Ride & Delivery Receipt", 50, 80);

    // Receipt number & date
    doc
      .fontSize(10)
      .fillColor("#111827")
      .text(`Receipt #${trip.id.slice(-8).toUpperCase()}`, 400, 50, { align: "right" })
      .fillColor(mutedColor)
      .text(formatDate(trip.completedAt ?? trip.createdAt), 400, 65, { align: "right" });

    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor(lineColor).stroke();

    // ── Trip details ─────────────────────────────────────────
    doc.fontSize(11).fillColor(mutedColor).text("TRIP DETAILS", 50, 125);

    const details = [
      ["Client", clientName],
      ["Trip Type", formatTripType(trip.type)],
      ["Status", formatStatus(trip.status)],
      ["Date", formatDate(trip.createdAt)],
      ...(trip.completedAt ? [["Completed At", formatDate(trip.completedAt)]] : []),
      ["Pickup", trip.pickupAddress],
      ["Drop-off", trip.dropoffAddress],
      ...(trip.distanceKm != null ? [["Distance", `${trip.distanceKm.toFixed(1)} km`]] : []),
      ...(trip.durationMin != null ? [["Duration", `${trip.durationMin} min`]] : []),
      ...(trip.rider ? [["Rider", `${trip.rider.name} · ${trip.rider.plateNumber ?? ""}`]] : []),
      ["Payment Method", formatPaymentMethod(trip.paymentMethod)],
    ] as [string, string][];

    let y = 145;
    for (const [label, value] of details) {
      doc
        .fontSize(10)
        .fillColor(mutedColor)
        .font("Helvetica")
        .text(label, 50, y);
      doc
        .fillColor("#111827")
        .font("Helvetica")
        .text(value, 200, y, { width: 345 });
      y += 18;
    }

    // Divider
    doc.moveTo(50, y + 8).lineTo(545, y + 8).strokeColor(lineColor).stroke();
    y += 20;

    // ── Fare breakdown ───────────────────────────────────────
    if (trip.fareBreakdown) {
      doc.fontSize(11).fillColor(mutedColor).text("FARE BREAKDOWN", 50, y);
      y += 20;

      const fareLines: [string, number][] = [
        ["Base fare", trip.fareBreakdown.baseFare],
        ["Distance fare", trip.fareBreakdown.distanceFare],
        ["Time fare", trip.fareBreakdown.timeFare],
      ];

      if (trip.fareBreakdown.surgeFactor > 1) {
        fareLines.push([
          `Surge (×${trip.fareBreakdown.surgeFactor.toFixed(1)})`,
          0,
        ]);
      }

      if (trip.fareBreakdown.tip > 0) {
        fareLines.push(["Tip", trip.fareBreakdown.tip]);
      }

      for (const [label, amount] of fareLines) {
        doc.fontSize(10).fillColor("#111827").text(label, 50, y);
        doc.text(amount > 0 ? `KES ${amount.toFixed(2)}` : "—", 450, y, { align: "right" });
        y += 16;
      }

      doc.moveTo(50, y + 4).lineTo(545, y + 4).strokeColor(lineColor).stroke();
      y += 12;

      // Total
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text("TOTAL", 50, y);
      doc
        .fontSize(13)
        .fillColor(primaryColor)
        .text(`KES ${trip.fareBreakdown.total.toFixed(2)}`, 450, y, { align: "right" });
      y += 30;
    } else if (trip.fareAmount != null) {
      doc
        .fontSize(13)
        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text("TOTAL", 50, y);
      doc
        .fontSize(13)
        .fillColor(primaryColor)
        .text(`KES ${trip.fareAmount.toFixed(2)}`, 450, y, { align: "right" });
      y += 30;
    }

    // ── Rating ───────────────────────────────────────────────
    if (trip.rating) {
      doc.moveTo(50, y).lineTo(545, y).strokeColor(lineColor).stroke();
      y += 12;
      doc.fontSize(10).fillColor(mutedColor).text("Your rating", 50, y);
      doc
        .fillColor("#FBBF24")
        .text("★".repeat(trip.rating.score) + "☆".repeat(5 - trip.rating.score), 200, y);
      if (trip.rating.comment) {
        y += 14;
        doc.fillColor("#4B5563").text(`"${trip.rating.comment}"`, 200, y, { width: 345 });
      }
      y += 24;
    }

    // ── Footer ───────────────────────────────────────────────
    doc
      .fontSize(9)
      .fillColor(mutedColor)
      .text(
        "Thank you for riding with Pikii. For disputes or support, visit support.pikii.co.ke",
        50,
        760,
        { align: "center", width: 495 }
      );

    doc.end();
  });
}

// ── Formatters ────────────────────────────────────────────────
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTripType(type: TripHistoryItem["type"]): string {
  const map: Record<string, string> = {
    RIDE: "Boda Ride",
    PARCEL: "Parcel Delivery",
    FOOD: "Food/Errand Delivery",
    ERRAND: "Errand",
  };
  return map[type] ?? type;
}

function formatStatus(status: TripHistoryItem["status"]): string {
  const map: Record<string, string> = {
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    IN_PROGRESS: "In Progress",
  };
  return map[status] ?? status;
}

function formatPaymentMethod(method: TripHistoryItem["paymentMethod"]): string {
  if (!method) return "N/A";
  const map: Record<string, string> = {
    MPESA: "M-Pesa",
    WALLET: "Pikii Wallet",
    CASH: "Cash",
  };
  return map[method] ?? method;
}
