import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { riderRejectSchema } from "@/lib/validation/onboarding";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/admin/riders/[riderId]/reject
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: PLATFORM_ADMIN)
// Body: { reason: string, rejectAllPendingDocuments?: boolean }
//
// Sets verificationStatus=REJECTED with the given reason, so the rider's
// onboarding UI can surface exactly what to fix and `canSubmitForReview`
// becomes true again once they address it (see onboarding.service —
// REJECTED is one of the two states submission is allowed from).
//
// If `rejectAllPendingDocuments` is true, every currently PENDING/AI_REVIEW
// Document for this rider is also marked REJECTED with the same reason
// (bulk reject — useful when the whole application is bad, e.g. clearly
// fraudulent). If false (default), only the overall RiderProfile status is
// rejected, leaving individually-approved/pending documents as-is so a
// rider only has to fix the specific thing called out — admins should
// reject individual documents via a future per-document admin endpoint
// (not in 3.1 scope) when only one item is wrong.
// =====================================================================================

interface RouteParams {
  params: Promise<{ riderId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["PLATFORM_ADMIN"]);
    const { riderId } = await params;

    const input = riderRejectSchema.parse(await req.json());

    const rider = await prisma.riderProfile.findUnique({ where: { id: riderId } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    await prisma.$transaction(async (tx) => {
      await tx.riderProfile.update({
        where: { id: riderId },
        data: { verificationStatus: "REJECTED", rejectionReason: input.reason, verifiedAt: null },
      });

      await tx.riderVerificationReview.create({
        data: {
          riderId,
          reviewerId: session.id,
          method: "MANUAL",
          decision: "REJECTED",
          notes: input.reason,
        },
      });

      if (input.rejectAllPendingDocuments) {
        await tx.document.updateMany({
          where: { riderId, isActive: true, status: { in: ["PENDING", "AI_REVIEW"] } },
          data: { status: "REJECTED", rejectionReason: input.reason, reviewedAt: new Date() },
        });
      }

      // TODO(3.13 Notifications): enqueue "RIDER_REJECTED" notification with
      // `input.reason` once the notification dispatch queue exists.
    });

    return ok({ message: t(session.locale, "RIDER_REVIEW_RECORDED") });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
