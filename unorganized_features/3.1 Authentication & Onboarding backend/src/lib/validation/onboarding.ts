import { z } from "zod";

// -------------------------------------------------------------------------------------
// Rider Onboarding Validation Schemas
// -------------------------------------------------------------------------------------

export const documentTypeEnum = z.enum([
  "NATIONAL_ID",
  "DRIVING_LICENSE",
  "PSV_BADGE",
  "LOGBOOK",
  "INSURANCE_CERTIFICATE",
  "PROFILE_PHOTO",
  "GOOD_CONDUCT_CERTIFICATE",
  "OTHER",
]);

export const vehicleTypeEnum = z.enum(["MOTORCYCLE", "TUKTUK", "CAR", "VAN"]);

export const licenseClassEnum = z.enum([
  "A1",
  "A2",
  "A3",
  "B",
  "CLASS_A",
  "CLASS_F",
  "OTHER",
]);

/**
 * Step 1 of rider onboarding — basic vehicle info. Performed once; later
 * edits go through the same endpoint (idempotent upsert against
 * RiderProfile, which already exists from signup).
 */
export const riderVehicleInfoSchema = z.object({
  vehicleType: vehicleTypeEnum,
  numberPlate: z
    .string()
    .min(4)
    .max(12)
    .transform((v) => v.toUpperCase().replace(/\s+/g, "")),
  vehicleMake: z.string().min(1).max(60).optional(),
  vehicleModel: z.string().min(1).max(60).optional(),
  vehicleColor: z.string().min(1).max(40).optional(),
  vehicleYear: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),

  licenseNumber: z.string().min(3).max(40).optional(),
  licenseClass: licenseClassEnum.optional(),
  licenseExpiresAt: z.coerce.date().optional(),

  psvBadgeNumber: z.string().min(3).max(40).optional(),
  psvBadgeExpiresAt: z.coerce.date().optional(),

  insurancePolicyNumber: z.string().min(3).max(60).optional(),
  insuranceExpiresAt: z.coerce.date().optional(),
});
export type RiderVehicleInfoInput = z.infer<typeof riderVehicleInfoSchema>;

/**
 * Request body for POST /api/onboarding/rider/documents — issues a
 * pre-signed S3 PUT URL. The actual file bytes go directly to S3 from the
 * client; this endpoint just registers metadata + returns the upload URL.
 */
export const documentUploadRequestSchema = z.object({
  type: documentTypeEnum,
  /// Original filename, used to derive extension + for audit display.
  filename: z.string().min(1).max(255),
  mimeType: z
    .string()
    .refine(
      (v) => ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(v),
      "File must be a JPEG, PNG, WEBP image or PDF."
    ),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(15 * 1024 * 1024, "File must be 15MB or smaller."),

  /// Structured number associated with this document (ID number, license
  /// number, logbook number, policy number, badge number). Optional because
  /// PROFILE_PHOTO has none.
  documentNumber: z.string().min(1).max(60).optional(),

  /// Required for DRIVING_LICENSE, INSURANCE_CERTIFICATE, PSV_BADGE.
  /// Validated conditionally below.
  expiresAt: z.coerce.date().optional(),
});

export const DOCUMENT_TYPES_REQUIRING_EXPIRY = [
  "DRIVING_LICENSE",
  "INSURANCE_CERTIFICATE",
  "PSV_BADGE",
] as const;

/**
 * Refines documentUploadRequestSchema to require `expiresAt` for document
 * types that have a validity period (3.1 — "expiry tracking").
 */
export const documentUploadRequestSchemaRefined = documentUploadRequestSchema.superRefine(
  (data, ctx) => {
    if (
      (DOCUMENT_TYPES_REQUIRING_EXPIRY as readonly string[]).includes(data.type) &&
      !data.expiresAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: `${data.type} requires an expiry date.`,
      });
    }

    if (data.expiresAt && data.expiresAt.getTime() <= Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Expiry date must be in the future.",
      });
    }
  }
);
export type DocumentUploadRequestInput = z.infer<typeof documentUploadRequestSchemaRefined>;

/**
 * Body for PATCH /api/onboarding/rider/documents/:id — called by the client
 * after the file has been successfully PUT to S3, to mark the document as
 * uploaded and (re)trigger AI review if enabled.
 */
export const documentUploadCompleteSchema = z.object({
  documentId: z.string().cuid(),
});
export type DocumentUploadCompleteInput = z.infer<typeof documentUploadCompleteSchema>;

/**
 * Payout method registration (3.1 — "Bank/M-Pesa details for payouts").
 * Discriminated union ensures M-Pesa vs Bank fields are mutually consistent.
 */
const mpesaPayoutSchema = z.object({
  method: z.literal("MPESA"),
  mpesaPhone: z
    .string()
    .min(9)
    .max(15),
  isDefault: z.boolean().default(true),
});

const bankPayoutSchema = z.object({
  method: z.literal("BANK_TRANSFER"),
  bankName: z.string().min(2).max(100),
  bankBranch: z.string().min(2).max(100).optional(),
  bankAccountNumber: z.string().min(4).max(34),
  accountHolderName: z.string().min(2).max(120),
  isDefault: z.boolean().default(true),
});

export const payoutMethodSchema = z.discriminatedUnion("method", [
  mpesaPayoutSchema,
  bankPayoutSchema,
]);
export type PayoutMethodInput = z.infer<typeof payoutMethodSchema>;

/**
 * GET query params for listing pending riders (admin review queue).
 */
export const pendingRidersQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PendingRidersQuery = z.infer<typeof pendingRidersQuerySchema>;

/**
 * Body for POST /api/admin/riders/:riderId/approve
 */
export const riderApproveSchema = z.object({
  notes: z.string().max(1000).optional(),
});

/**
 * Body for POST /api/admin/riders/:riderId/reject
 */
export const riderRejectSchema = z.object({
  reason: z.string().min(3).max(1000),
  /// If true, individual Document rows that are PENDING/AI_REVIEW are also
  /// marked REJECTED with this reason (bulk reject). If false, only the
  /// overall RiderProfile.verificationStatus is set to REJECTED, leaving
  /// individually-approved documents intact for a faster resubmission.
  rejectAllPendingDocuments: z.boolean().default(false),
});
