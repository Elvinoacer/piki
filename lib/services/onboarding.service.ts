import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { runAiDocumentCheck } from "@/lib/services/ai-document-check";
import type { DocumentType, RiderProfile, VehicleType, Document } from "@/app/generated/prisma/client";

// -------------------------------------------------------------------------------------
// Rider Onboarding Service
// -------------------------------------------------------------------------------------
// Encapsulates the business rules for 3.1's rider onboarding checklist:
//   - which documents are required for a given vehicle type
//   - whether a rider's onboarding form is "complete" (ready to submit)
//   - dispatching AI document checks when enabled
//   - the going-online gate (verificationStatus must be APPROVED)
// -------------------------------------------------------------------------------------

/**
 * Documents required for every vehicle type, per 3.1:
 *   - National ID upload & verification
 *   - Driving license (Class A/F) upload & expiry tracking
 *   - Motorcycle logbook / number plate
 *   - Insurance certificate upload & expiry tracking
 *   - Profile photo (face match recommended)
 *
 * PSV_BADGE is conditionally required ("if applicable") — required for
 * CAR and VAN (commonly operated under PSV regulations), optional for
 * MOTORCYCLE and TUKTUK. Adjust here if business rules evolve; this is the
 * single source of truth referenced by both the submit-check and the
 * frontend (via GET /api/onboarding/rider/status).
 */
export function getRequiredDocumentTypes(vehicleType: VehicleType): DocumentType[] {
  const base: DocumentType[] = [
    "NATIONAL_ID",
    "DRIVING_LICENSE",
    "LOGBOOK",
    "INSURANCE_CERTIFICATE",
    "PROFILE_PHOTO",
  ];

  if (vehicleType === "CAR" || vehicleType === "VAN") {
    return [...base, "PSV_BADGE"];
  }

  return base;
}

export interface OnboardingStatusSummary {
  vehicleType: VehicleType;
  requiredDocumentTypes: DocumentType[];
  documents: Array<{
    type: DocumentType;
    status: Document["status"];
    expiresAt: Date | null;
    rejectionReason: string | null;
    uploadedAt: Date | null;
    /// True once the rider has uploaded this document at least once. False
    /// means it's still missing (status will be the PENDING placeholder
    /// below, which is otherwise indistinguishable from "uploaded but not
    /// yet reviewed" — callers should branch on `isUploaded`, not `status`,
    /// when determining what's still missing from the checklist.
    isUploaded: boolean;
  }>;
  hasVehicleInfo: boolean;
  hasPayoutMethod: boolean;
  isFormComplete: boolean;
  verificationStatus: RiderProfile["verificationStatus"];
  canSubmitForReview: boolean;
  canGoOnline: boolean;
}

/**
 * Computes a full onboarding status summary for a rider — used by both the
 * GET /status endpoint and internally before allowing a submission.
 */
export async function getOnboardingStatus(riderId: string): Promise<OnboardingStatusSummary> {
  const rider = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    include: {
      documents: { where: { isActive: true } },
      payoutMethods: true,
    },
  });

  const requiredTypes = getRequiredDocumentTypes(rider.vehicleType);

  const documents = requiredTypes.map((type) => {
    const doc = rider.documents.find((d) => d.type === type);
    return {
      type,
      status: doc?.status ?? ("PENDING" as Document["status"]),
      expiresAt: doc?.expiresAt ?? null,
      rejectionReason: doc?.rejectionReason ?? null,
      uploadedAt: doc?.uploadedAt ?? null,
      isUploaded: doc !== undefined,
    };
  });

  const allRequiredUploaded = requiredTypes.every((type) =>
    rider.documents.some((d) => d.type === type)
  );

  const hasVehicleInfo = Boolean(
    rider.numberPlate && rider.licenseNumber && rider.insurancePolicyNumber
  );

  const hasPayoutMethod = rider.payoutMethods.length > 0;

  const isFormComplete = allRequiredUploaded && hasVehicleInfo && hasPayoutMethod;

  const canSubmitForReview =
    isFormComplete &&
    (rider.verificationStatus === "INCOMPLETE" || rider.verificationStatus === "REJECTED");

  const canGoOnline = rider.verificationStatus === "APPROVED";

  return {
    vehicleType: rider.vehicleType,
    requiredDocumentTypes: requiredTypes,
    documents,
    hasVehicleInfo,
    hasPayoutMethod,
    isFormComplete,
    verificationStatus: rider.verificationStatus,
    canSubmitForReview,
    canGoOnline,
  };
}

/**
 * Marks a rider's onboarding as submitted for review. Sets
 * verificationStatus = PENDING_REVIEW and stamps onboardingCompletedAt.
 *
 * If AI_DOC_CHECK_ENABLED, dispatches AI checks for all active documents
 * that haven't been AI-reviewed yet (fire-and-forget per document, but
 * awaited here so the response can reflect immediate AI results where the
 * provider responds synchronously).
 *
 * Caller MUST have already confirmed `canSubmitForReview` via
 * {@link getOnboardingStatus} — this function does not re-check completeness
 * to avoid duplicating the (slightly expensive) document-join query; route
 * handlers should call getOnboardingStatus() first.
 */
export async function submitOnboardingForReview(riderId: string): Promise<void> {
  const env = getEnv();

  await prisma.riderProfile.update({
    where: { id: riderId },
    data: {
      verificationStatus: "PENDING_REVIEW",
      onboardingCompletedAt: new Date(),
      rejectionReason: null,
    },
  });

  if (!env.AI_DOC_CHECK_ENABLED) return;

  const documents = await prisma.document.findMany({
    where: { riderId, isActive: true, status: { in: ["PENDING"] } },
  });

  // Run sequentially to avoid hammering the AI provider; document counts per
  // rider are small (5-6), so this is acceptably fast.
  for (const doc of documents) {
    await runAiDocumentCheck(doc.id);
  }
}

/**
 * Re-evaluates whether a rider should automatically transition to APPROVED
 * based on AI check results. Called after each AI check completes.
 *
 * Auto-approval rule: if AI_DOC_CHECK_ENABLED and every required document
 * for the rider's vehicleType has status APPROVED (set by the AI check) AND
 * the rider's verificationStatus is PENDING_REVIEW, transition to APPROVED
 * and record a RiderVerificationReview with method=AI_AUTOMATED.
 *
 * This intentionally does NOT auto-reject — rejections always go through a
 * human admin (or an explicit reject call), since false-positive rejections
 * are costlier (a blocked rider) than a delayed approval.
 */
export async function maybeAutoApproveAfterAiCheck(riderId: string): Promise<void> {
  const env = getEnv();
  if (!env.AI_DOC_CHECK_ENABLED) return;

  const rider = await prisma.riderProfile.findUniqueOrThrow({
    where: { id: riderId },
    include: { documents: { where: { isActive: true } } },
  });

  if (rider.verificationStatus !== "PENDING_REVIEW") return;

  const requiredTypes = getRequiredDocumentTypes(rider.vehicleType);
  const allApproved = requiredTypes.every((type) =>
    rider.documents.some((d) => d.type === type && d.status === "APPROVED")
  );

  if (!allApproved) return;

  await prisma.$transaction([
    prisma.riderProfile.update({
      where: { id: riderId },
      data: { verificationStatus: "APPROVED", verifiedAt: new Date(), rejectionReason: null },
    }),
    prisma.riderVerificationReview.create({
      data: {
        riderId,
        reviewerId: null,
        method: "AI_AUTOMATED",
        decision: "APPROVED",
        notes: "All required documents passed automated review.",
      },
    }),
  ]);
}
