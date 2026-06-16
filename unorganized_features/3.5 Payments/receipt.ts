// lib/payments/receipt.ts
// PDF receipt generator for completed trips
// Uses pdfkit (install: npm install pdfkit @types/pdfkit)

import PDFDocument from "pdfkit";
import { ReceiptData } from "@/types/payments";

// ----------------------------------------------------------------
// Generate PDF receipt as Buffer
// ----------------------------------------------------------------
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ---- Header ----
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#1a1a2e")
      .text("Pikii", { align: "center" });

    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555")
      .text("Bodaboda Ride & Delivery", { align: "center" });

    doc.moveDown(0.5);

    // Divider
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#e0e0e0")
      .stroke();

    doc.moveDown(1);

    // ---- Receipt Meta ----
    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .fillColor("#1a1a2e")
      .text("Trip Receipt", { align: "center" });

    doc.moveDown(0.5);

    row(doc, "Receipt No.", data.receiptNumber);
    row(doc, "Date", formatDate(data.tripDate));
    row(doc, "Trip ID", data.tripId);

    doc.moveDown(0.5);
    sectionHeader(doc, "Parties");

    row(doc, "Client", data.clientName);
    row(doc, "Rider", data.riderName);
    row(doc, "Plate No.", data.riderPlate);

    doc.moveDown(0.5);
    sectionHeader(doc, "Trip Details");

    row(doc, "From", data.pickupAddress);
    row(doc, "To", data.dropoffAddress);
    row(doc, "Distance", `${data.distanceKm.toFixed(1)} km`);
    row(doc, "Duration", `${data.durationMinutes} mins`);

    doc.moveDown(0.5);
    sectionHeader(doc, "Fare Breakdown");

    row(doc, "Base Fare", `KES ${data.fareBreakdown.baseFare.toFixed(2)}`);
    if (data.fareBreakdown.tip > 0) {
      row(doc, "Tip", `KES ${data.fareBreakdown.tip.toFixed(2)}`);
    }

    doc.moveDown(0.3);
    // Total — highlighted
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor("#1a1a2e")
      .text(
        `TOTAL PAID: KES ${data.fareBreakdown.total.toFixed(2)}`,
        { align: "right" }
      );

    doc.moveDown(0.5);
    sectionHeader(doc, "Payment");

    row(doc, "Method", data.paymentMethod);
    if (data.mpesaReceiptNumber) {
      row(doc, "M-Pesa Ref", data.mpesaReceiptNumber);
    }

    // ---- Footer ----
    doc.moveDown(2);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#e0e0e0")
      .stroke();

    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#999")
      .text(
        "Thank you for riding with Pikii. For support: support@pikii.co.ke | pikii.co.ke",
        { align: "center" }
      );

    doc.end();
  });
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function sectionHeader(doc: PDFKit.PDFDocument, title: string) {
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("#1a1a2e")
    .text(title.toUpperCase());
  doc
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .strokeColor("#ddd")
    .stroke();
  doc.moveDown(0.3);
}

function row(doc: PDFKit.PDFDocument, label: string, value: string) {
  const y = doc.y;
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#333")
    .text(label, 50, y, { width: 160 });
  doc
    .font("Helvetica")
    .fillColor("#555")
    .text(value, 210, y, { width: 335 });
  doc.moveDown(0.4);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

// ----------------------------------------------------------------
// Generate receipt number
// ----------------------------------------------------------------
export function generateReceiptNumber(tripId: string): string {
  const suffix = tripId.slice(-6).toUpperCase();
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `PKI-${date}-${suffix}`;
}
