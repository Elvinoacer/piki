import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { getOnboardingStatus, submitOnboardingForReview } from "@/lib/services/onboarding.service";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/onboarding/rider/submit
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
//
// Final step of 3.1's rider onboarding flow: "Admin manual or automated (AI
// document check) approval before going online." Validates that all
// required documents are uploaded and vehicle info + a payout method are
// set, then transitions RiderProfile.verificationStatus from
// INCOMPLETE/REJECTED to PENDING_REVIEW and (if AI checks are enabled)
// dispatches them immediately — which may result in an instant AUTO-APPROVE
// if every document passes, or leave the rider in PENDING_REVIEW for a
// human admin otherwise.
//
// Errors: 422 ONBOARDING_INCOMPLETE if the checklist isn't fully satisfied,
// or if verificationStatus is already PENDING_REVIEW or APPROVED (can't
// resubmit something already submitted/approved — vehicle-info edits to an
// APPROVED rider instead auto-reopen review, see vehicle-info route).
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const status = await getOnboardingStatus(rider.id);

    if (!status.canSubmitForReview) {
      throw new ApiError(422, "ONBOARDING_INCOMPLETE", session.locale, {
        missingDocuments: status.documents.filter((d) => !d.isUploaded).map((d) => d.type),
        hasVehicleInfo: status.hasVehicleInfo,
        hasPayoutMethod: status.hasPayoutMethod,
        currentVerificationStatus: status.verificationStatus,
      });
    }

    await submitOnboardingForReview(rider.id);

    const refreshedStatus = await getOnboardingStatus(rider.id);

    return ok({
      message:
        refreshedStatus.verificationStatus === "APPROVED"
          ? t(session.locale, "RIDER_APPROVED")
          : t(session.locale, "ONBOARDING_SUBMITTED"),
      status: refreshedStatus,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
