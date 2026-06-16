import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { riderVehicleInfoSchema, type RiderVehicleInfoInput } from "@/lib/validation/onboarding";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { Prisma, type RiderProfile } from "@/app/generated/prisma/client";

// =====================================================================================
// PUT /api/onboarding/rider/vehicle-info
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
// Body: see riderVehicleInfoSchema — vehicleType, numberPlate, license info,
//       optional PSV badge info, insurance info.
//
// Upserts structured vehicle/license/insurance fields onto the caller's
// RiderProfile (created automatically at signup). Idempotent — can be
// called repeatedly to correct/update info up until the rider is APPROVED;
// after approval, edits to safety-critical fields (license/insurance
// numbers, plate) should ideally re-trigger review, but that escalation
// policy is intentionally left to a follow-up (flagged below) rather than
// silently blocking edits, since e.g. typo fixes are common and shouldn't
// require a full re-review cycle.
//
// NOTE: if verificationStatus is currently APPROVED and the rider changes
// `numberPlate`, `licenseNumber`, or `insurancePolicyNumber`, this
// downgrades verificationStatus back to PENDING_REVIEW — these are exactly
// the fields a malicious/compromised actor would swap to operate under a
// different identity, so they re-require review. Cosmetic fields (make,
// model, color, year) do NOT trigger re-review.
// =====================================================================================

const REVIEW_TRIGGERING_FIELDS: ReadonlyArray<keyof RiderVehicleInfoInput & keyof RiderProfile> = [
  "numberPlate",
  "licenseNumber",
  "insurancePolicyNumber",
];

export async function PUT(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const input = riderVehicleInfoSchema.parse(await req.json());

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const changedSensitiveField = REVIEW_TRIGGERING_FIELDS.some(
      (field) => input[field] !== undefined && input[field] !== rider[field]
    );

    const shouldDowngradeToReview = rider.verificationStatus === "APPROVED" && changedSensitiveField;

    try {
      const updated = await prisma.riderProfile.update({
        where: { id: rider.id },
        data: {
          ...input,
          ...(shouldDowngradeToReview
            ? { verificationStatus: "PENDING_REVIEW" as const, verifiedAt: null }
            : {}),
        },
      });

      return ok({
        riderProfile: updated,
        reviewReopened: shouldDowngradeToReview,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Unique constraint violation — most likely numberPlate already
        // registered to another rider.
        throw new ApiError(409, "VALIDATION_ERROR", session.locale, {
          fieldErrors: { numberPlate: ["This number plate is already registered."] },
        });
      }
      throw err;
    }
  } catch (err) {
    return errorResponse(err, locale);
  }
}
