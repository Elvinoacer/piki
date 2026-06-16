import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { riderApproveSchema } from "@/lib/validation/onboarding";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/admin/riders/[riderId]/approve
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: PLATFORM_ADMIN)
// Body: { notes?: string }
//
// Manual admin approval path for 3.1's "Admin manual ... approval before
// going online." Sets verificationStatus=APPROVED, stamps verifiedAt,
// clears any prior rejectionReason, and writes a RiderVerificationReview
// audit row with method=MANUAL, decision=APPROVED, reviewerId=<admin>.
//
// Idempotent-ish: re-approving an already-APPROVED rider succeeds and just
// records another review row (e.g. an admin re-confirming after a renewed
// document) rather than erroring, since that's a benign, audit-worthy action.
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

    const input = riderApproveSchema.parse(await req.json().catch(() => ({})));

    const rider = await prisma.riderProfile.findUnique({
      where: { id: riderId },
      include: { user: { select: { locale: true } } },
    });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    await prisma.$transaction([
      prisma.riderProfile.update({
        where: { id: riderId },
        data: { verificationStatus: "APPROVED", verifiedAt: new Date(), rejectionReason: null },
      }),
      prisma.riderVerificationReview.create({
        data: {
          riderId,
          reviewerId: session.id,
          method: "MANUAL",
          decision: "APPROVED",
          notes: input.notes,
        },
      }),
      // TODO(3.13 Notifications): enqueue a push/SMS notification to the
      // rider ("RIDER_APPROVED") once the notification dispatch service
      // exists. Left as a follow-up hook rather than a direct SMS call here
      // to avoid this route depending on the not-yet-built notifications
      // queue (BullMQ) infra from section 4.1.
    ]);

    return ok({ message: t(session.locale, "RIDER_REVIEW_RECORDED") });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
