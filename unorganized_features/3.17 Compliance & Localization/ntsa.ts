// lib/compliance/ntsa.ts
// NTSA-aligned document types, validation rules, and status utilities.

export const NTSA_DOCUMENT_TYPES = [
  "NATIONAL_ID",
  "DRIVING_LICENSE",
  "NTSA_PSV_BADGE",
  "LOGBOOK",
  "INSURANCE",
  "PROFILE_PHOTO",
] as const;

export type NtsaDocumentType = (typeof NTSA_DOCUMENT_TYPES)[number];

/** Days before expiry at which we surface a warning to the rider */
export const EXPIRY_WARNING_DAYS = 30;
export const EXPIRY_CRITICAL_DAYS = 7;

export type DocumentStatus = "missing" | "pending" | "verified" | "expired" | "expiring_soon" | "expiring_critical";

export interface ComplianceDocument {
  type: NtsaDocumentType;
  status: DocumentStatus;
  fileUrl?: string;
  expiresAt?: Date | null;
  verifiedAt?: Date | null;
  uploadedAt?: Date | null;
}

/** Derive status from raw DB fields */
export function deriveDocumentStatus(doc: {
  fileUrl?: string | null;
  verifiedAt?: Date | null;
  expiresAt?: Date | null;
  adminRejectedAt?: Date | null;
}): DocumentStatus {
  if (!doc.fileUrl) return "missing";

  const now = new Date();

  if (doc.expiresAt) {
    const daysLeft = Math.ceil((doc.expiresAt.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft <= 0) return "expired";
    if (daysLeft <= EXPIRY_CRITICAL_DAYS) return "expiring_critical";
    if (daysLeft <= EXPIRY_WARNING_DAYS) return "expiring_soon";
  }

  if (!doc.verifiedAt) return "pending";
  return "verified";
}

/** True when all required docs are verified and none are expired */
export function isRiderCompliant(docs: ComplianceDocument[]): boolean {
  return NTSA_DOCUMENT_TYPES.every((type) => {
    const doc = docs.find((d) => d.type === type);
    return doc?.status === "verified" || doc?.status === "expiring_soon";
  });
}

/** Docs that block the rider from going online */
export function getBlockingDocuments(docs: ComplianceDocument[]): ComplianceDocument[] {
  return docs.filter(
    (d) => d.status === "missing" || d.status === "expired" || d.status === "expiring_critical"
  );
}
