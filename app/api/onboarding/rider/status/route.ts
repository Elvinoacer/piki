import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { getOnboardingStatus } from "@/lib/services/onboarding.service";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";

// =====================================================================================
// GET /api/onboarding/rider/status
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: RIDER)
//
// Returns a full checklist-style summary the frontend can render directly
// as the onboarding progress screen:
//   - which document types are required (depends on vehicleType)
//   - per-document status (missing / PENDING / AI_REVIEW / APPROVED / REJECTED)
//   - whether vehicle info + payout method are filled in
//   - whether the form as a whole is complete and ready to submit
//   - the current admin/AI verification status
//   - whether the rider is cleared to go online (3.9 dashboard gate)
// =====================================================================================

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["RIDER"]);

    const rider = await prisma.riderProfile.findUnique({ where: { userId: session.id } });
    if (!rider) {
      throw new ApiError(404, "NOT_FOUND", locale);
    }

    const status = await getOnboardingStatus(rider.id);

    return ok(status);
  } catch (err) {
    return errorResponse(err, locale);
  }
}
