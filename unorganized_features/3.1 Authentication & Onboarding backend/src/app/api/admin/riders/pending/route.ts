import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertRole } from "@/lib/auth/session";
import { pendingRidersQuerySchema } from "@/lib/validation/onboarding";
import { createDownloadUrl } from "@/lib/storage/s3";
import { ok, errorResponse, resolveLocale } from "@/lib/api-response";

// =====================================================================================
// GET /api/admin/riders/pending
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>  (role: PLATFORM_ADMIN)
// Query: ?cursor=<riderProfileId>&limit=20
//
// Returns a cursor-paginated queue of RiderProfiles with
// verificationStatus=PENDING_REVIEW, ordered oldest-submitted-first (FIFO
// review queue — fairest for riders waiting to start earning). Each entry
// includes the rider's user identity, vehicle info, and signed view URLs
// for every active document, so an admin can review entirely from this one
// payload without N+1 follow-up requests per rider.
// =====================================================================================

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    assertRole(session, ["PLATFORM_ADMIN", "SUPPORT_AGENT"]);

    const { cursor, limit } = pendingRidersQuerySchema.parse({
      cursor: req.nextUrl.searchParams.get("cursor") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined,
    });

    const riders = await prisma.riderProfile.findMany({
      where: { verificationStatus: "PENDING_REVIEW" },
      orderBy: { onboardingCompletedAt: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        documents: { where: { isActive: true } },
      },
    });

    const hasMore = riders.length > limit;
    const page = hasMore ? riders.slice(0, limit) : riders;

    const result = await Promise.all(
      page.map(async (rider) => ({
        riderId: rider.id,
        user: rider.user,
        vehicleType: rider.vehicleType,
        numberPlate: rider.numberPlate,
        licenseNumber: rider.licenseNumber,
        licenseClass: rider.licenseClass,
        licenseExpiresAt: rider.licenseExpiresAt,
        insurancePolicyNumber: rider.insurancePolicyNumber,
        insuranceExpiresAt: rider.insuranceExpiresAt,
        faceMatchScore: rider.faceMatchScore,
        onboardingCompletedAt: rider.onboardingCompletedAt,
        documents: await Promise.all(
          rider.documents.map(async (doc) => ({
            id: doc.id,
            type: doc.type,
            status: doc.status,
            documentNumber: doc.documentNumber,
            expiresAt: doc.expiresAt,
            aiCheckScore: doc.aiCheckScore,
            viewUrl: await createDownloadUrl(doc.fileKey),
          }))
        ),
      }))
    );

    return ok({
      riders: result,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
