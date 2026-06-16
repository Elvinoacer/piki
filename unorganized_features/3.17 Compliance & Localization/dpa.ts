// lib/compliance/dpa.ts
// Kenya Data Protection Act, 2019 — consent management helpers.
// Aligns with Sections 30–34 of the Act (data subject rights).

export type ConsentPurpose = "location" | "marketing" | "analytics";

export interface UserConsent {
  userId: string;
  location: boolean;
  marketing: boolean;
  analytics: boolean;
  updatedAt: Date;
  ipAddress?: string; // Log IP at consent capture per DPA §30
}

export interface DataExportRequest {
  userId: string;
  requestedAt: Date;
  status: "pending" | "processing" | "ready" | "delivered" | "failed";
  downloadUrl?: string;
  expiresAt?: Date; // Signed URL expiry
}

export interface AccountDeletionRequest {
  userId: string;
  requestedAt: Date;
  scheduledAt?: Date; // Deletion runs after cooling-off period
  status: "pending" | "scheduled" | "completed" | "cancelled";
  reason?: string;
}

/** Cooling-off period before permanent deletion (days) — gives user a window to cancel */
export const DELETION_COOLING_OFF_DAYS = 14;

/** How long to retain financial records after deletion (years) — Kenya law minimum */
export const FINANCIAL_RETENTION_YEARS = 7;

/** Redact PII fields from a user record, retaining only legally required data */
export function redactUserPii(user: Record<string, unknown>): Record<string, unknown> {
  const REDACT_FIELDS = ["name", "email", "phoneNumber", "profilePhotoUrl", "nationalId"];
  const redacted = { ...user };
  for (const field of REDACT_FIELDS) {
    if (field in redacted) {
      redacted[field] = "[REDACTED]";
    }
  }
  redacted["deletedAt"] = new Date().toISOString();
  return redacted;
}

/** Validate that at least location consent is present (required for core app function) */
export function validateRequiredConsent(consent: Partial<UserConsent>): boolean {
  return consent.location === true;
}

/** Human-readable list of DPA §34 subject rights */
export const DPA_SUBJECT_RIGHTS = [
  "dpa_rights_access",
  "dpa_rights_rectification",
  "dpa_rights_erasure",
  "dpa_rights_portability",
  "dpa_rights_objection",
] as const;

export type DpaRight = (typeof DPA_SUBJECT_RIGHTS)[number];
