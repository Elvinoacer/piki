import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { createDownloadUrl } from "@/lib/storage/s3";

// -------------------------------------------------------------------------------------
// AI Document Check Service
// -------------------------------------------------------------------------------------
// Implements the "automated (AI document check) approval" option from 3.1.
// This is a thin adapter over a configurable external provider
// (AI_DOC_CHECK_PROVIDER_URL) — kept provider-agnostic so a specific vendor
// (e.g. a KYC API) can be swapped in without touching calling code.
//
// Contract with the external provider (expected JSON response):
//   {
//     "approved": boolean,
//     "confidence": number,        // 0..1
//     "extracted": { ... }         // optional OCR'd fields (e.g. ID number, expiry)
//     "reason": string | null      // present if approved=false
//   }
//
// If the provider call fails or AI_DOC_CHECK_ENABLED=false, the document is
// left in PENDING for manual review — AI check is an accelerant, not a
// hard dependency.
// -------------------------------------------------------------------------------------

interface AiProviderResponse {
  approved: boolean;
  confidence: number;
  extracted?: Record<string, unknown>;
  reason?: string | null;
}

/**
 * Runs an AI check for a single document. Updates Document.status,
 * Document.verificationMethod, Document.aiCheckResultJson/aiCheckScore, and
 * — on approval — triggers {@link maybeAutoApproveAfterAiCheck} for the
 * parent rider.
 *
 * Safe to call even if AI_DOC_CHECK_ENABLED=false (no-ops). Safe to call
 * multiple times for the same document (idempotent: re-runs the check and
 * overwrites the prior AI result).
 */
export async function runAiDocumentCheck(documentId: string): Promise<void> {
  const env = getEnv();
  if (!env.AI_DOC_CHECK_ENABLED || !env.AI_DOC_CHECK_PROVIDER_URL) return;

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "AI_REVIEW" },
  });

  let result: AiProviderResponse | null = null;

  try {
    const fileUrl = await createDownloadUrl(document.fileKey);

    const res = await fetch(env.AI_DOC_CHECK_PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_DOC_CHECK_API_KEY}`,
      },
      body: JSON.stringify({
        documentType: document.type,
        fileUrl,
        documentNumber: document.documentNumber,
        expiresAt: document.expiresAt,
      }),
    });

    if (res.ok) {
      result = (await res.json()) as AiProviderResponse;
    }
  } catch (err) {
    // Network/provider error — fall through to PENDING (manual review).
    // eslint-disable-next-line no-console
    console.error(`AI document check failed for document ${documentId}:`, err);
  }

  if (!result) {
    // Revert to PENDING so it remains in the manual review queue.
    await prisma.document.update({ where: { id: documentId }, data: { status: "PENDING" } });
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: result.approved ? "APPROVED" : "REJECTED",
      verificationMethod: "AI_AUTOMATED",
      aiCheckResultJson: result as unknown as object,
      aiCheckScore: result.confidence,
      rejectionReason: result.approved ? null : result.reason ?? "Automated check did not pass.",
      reviewedAt: new Date(),
    },
  });

  if (result.approved) {
    const { maybeAutoApproveAfterAiCheck } = await import("@/lib/services/onboarding.service");
    await maybeAutoApproveAfterAiCheck(document.riderId);
  }
}

/**
 * Compares the PROFILE_PHOTO document against the NATIONAL_ID document for
 * face-match (3.1 — "Profile photo (face match recommended)"). Stores the
 * result on RiderProfile.faceMatchScore / faceMatchVerifiedAt.
 *
 * Like {@link runAiDocumentCheck}, this is a no-op if AI checks are
 * disabled or the provider call fails — face match is advisory and does not
 * block approval on its own; a low score should be surfaced to the human
 * reviewer (e.g. in the admin review queue UI) rather than auto-rejecting.
 */
export async function runFaceMatchCheck(riderId: string): Promise<void> {
  const env = getEnv();
  if (!env.AI_DOC_CHECK_ENABLED || !env.AI_DOC_CHECK_PROVIDER_URL) return;

  const [profilePhoto, nationalId] = await Promise.all([
    prisma.document.findFirst({
      where: { riderId, type: "PROFILE_PHOTO", isActive: true },
    }),
    prisma.document.findFirst({
      where: { riderId, type: "NATIONAL_ID", isActive: true },
    }),
  ]);

  if (!profilePhoto || !nationalId) return;

  try {
    const [profileUrl, idUrl] = await Promise.all([
      createDownloadUrl(profilePhoto.fileKey),
      createDownloadUrl(nationalId.fileKey),
    ]);

    const res = await fetch(`${env.AI_DOC_CHECK_PROVIDER_URL}/face-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_DOC_CHECK_API_KEY}`,
      },
      body: JSON.stringify({ selfieUrl: profileUrl, idPhotoUrl: idUrl }),
    });

    if (!res.ok) return;

    const json = (await res.json()) as { score: number };

    await prisma.riderProfile.update({
      where: { id: riderId },
      data: { faceMatchScore: json.score, faceMatchVerifiedAt: new Date() },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Face match check failed for rider ${riderId}:`, err);
  }
}
