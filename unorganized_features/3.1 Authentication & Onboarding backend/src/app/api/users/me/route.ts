import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { ok, errorResponse, resolveLocale } from "@/lib/api-response";
import { z } from "zod";

// =====================================================================================
// GET /api/users/me
// -------------------------------------------------------------------------------------
// Header: Authorization: Bearer <accessToken>
//
// Returns the current user's identity + role-specific profile summary.
// This is the first call the frontend makes on app boot to determine:
//   - which dashboard to render (Client / Rider / SACCO Admin / Admin)
//   - for RIDER: verificationStatus, so the app can route to onboarding vs.
//     the main rider dashboard (3.9) vs. an "awaiting approval" screen.
// =====================================================================================

export async function GET(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        riderProfile: {
          select: {
            id: true,
            vehicleType: true,
            verificationStatus: true,
            availability: true,
            onboardingCompletedAt: true,
            verifiedAt: true,
            ratingAverage: true,
            ratingCount: true,
            saccoId: true,
            saccoMembershipStatus: true,
          },
        },
        clientProfile: { select: { id: true } },
      },
    });

    return ok({
      id: user.id,
      phone: user.phone,
      phoneIsPlaceholder: user.phone.startsWith("+000GOOGLE"),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      locale: user.locale,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
      riderProfile: user.riderProfile,
      clientProfile: user.clientProfile,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

// -------------------------------------------------------------------------------------
// PATCH /api/users/me
// -------------------------------------------------------------------------------------
// Body (all optional): { firstName?, lastName?, email?, locale?: "EN"|"SW", marketingOptIn? }
//
// Updates basic profile fields. Phone number changes are NOT handled here —
// they require a fresh OTP verification (purpose=PHONE_CHANGE) and should go
// through a dedicated endpoint to keep the security-sensitive flow explicit
// (not implemented in this feature slice; tracked as a follow-up alongside
// PHONE_CHANGE OTP support already present in the schema/enum).
// -------------------------------------------------------------------------------------

const updateMeSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  email: z.string().email().max(255).optional(),
  locale: z.enum(["EN", "SW"]).optional(),
  marketingOptIn: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const session = await requireUser(req);
    const input = updateMeSchema.parse(await req.json());

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: input,
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        locale: true,
        marketingOptIn: true,
      },
    });

    return ok(updated);
  } catch (err) {
    return errorResponse(err, locale);
  }
}
