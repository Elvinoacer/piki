import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import { verifyOtpVerificationToken } from "@/lib/otp/otp-service";
import { generateUniqueReferralCode } from "@/lib/services/referral.service";
import { issueSession } from "@/lib/services/session.service";
import { created, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";
import type { Prisma } from "@/app/generated/prisma/client";

// =====================================================================================
// POST /api/auth/signup
// -------------------------------------------------------------------------------------
// Body:
//   {
//     phone, otpVerificationToken,        // proof of OTP verification (purpose=SIGNUP)
//     role: "CLIENT" | "RIDER" | "SACCO_ADMIN",
//     firstName?, lastName?, email?,
//     locale?: "EN" | "SW",
//     referralCode?,                       // another user's referral code
//     saccoId?,                            // RIDER only — link to a SACCO (pending)
//     acceptedTerms: true, acceptedPrivacy: true,
//     marketingOptIn?: boolean
//   }
//
// Creates the User row, sets status=ACTIVE (phone already verified via OTP),
// generates this user's own referral code, and provisions a role-specific
// profile:
//   - CLIENT      -> ClientProfile
//   - RIDER       -> RiderProfile (verificationStatus=INCOMPLETE; optional
//                    SACCO link with saccoMembershipStatus=PENDING)
//   - SACCO_ADMIN -> no profile row in 3.1 scope (SaccoOrg/admin linkage is
//                    part of 3.11, deferred). Account is created with role
//                    SACCO_ADMIN and status=ACTIVE; full SACCO admin
//                    capabilities are gated by 3.11's approval flow when
//                    that module lands. This satisfies "Role selection at
//                    signup ... with approval flow" at the account level —
//                    org-level approval is a separate, later step.
//
// On success, returns the created user summary + an issued session
// (access + refresh tokens) so the client is immediately logged in.
//
// Errors:
//   400 OTP_EXPIRED            — verification token invalid/stale
//   409 PHONE_ALREADY_REGISTERED
//   404 NOT_FOUND               — saccoId provided but SACCO doesn't exist
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const body = await req.json();
    const input = signupSchema.parse(body);

    // --- Verify OTP proof ---------------------------------------------------------
    await verifyOtpVerificationToken(input.otpVerificationToken, input.phone, "SIGNUP", locale);

    // --- Ensure phone not already registered (race-safe via unique constraint,
    // but check first for a friendlier error) ---------------------------------------
    const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
    if (existing) {
      throw new ApiError(409, "PHONE_ALREADY_REGISTERED", input.locale);
    }

    // --- Resolve referrer (best-effort; invalid code is ignored, not an error) -----
    let referredById: string | undefined;
    if (input.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: input.referralCode },
        select: { id: true },
      });
      referredById = referrer?.id;
    }

    // --- Validate SACCO link target (RIDER only) ------------------------------------
    if (input.role === "RIDER" && input.saccoId) {
      const sacco = await prisma.saccoOrg.findUnique({ where: { id: input.saccoId } });
      if (!sacco) {
        throw new ApiError(404, "NOT_FOUND", input.locale);
      }
    }

    const referralCode = await generateUniqueReferralCode();
    const now = new Date();

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          phone: input.phone,
          phoneVerifiedAt: now,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          status: "ACTIVE",
          locale: input.locale,
          referralCode,
          referredById,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
          marketingOptIn: input.marketingOptIn,
        },
      });

      if (input.role === "CLIENT") {
        await tx.clientProfile.create({ data: { userId: created.id } });
      }

      if (input.role === "RIDER") {
        const riderData: Prisma.RiderProfileUncheckedCreateInput = {
          userId: created.id,
          verificationStatus: "INCOMPLETE",
        };
        if (input.saccoId) {
          riderData.saccoId = input.saccoId;
          riderData.saccoMembershipStatus = "PENDING";
        }
        await tx.riderProfile.create({ data: riderData });
      }

      // SACCO_ADMIN: no additional profile row in 3.1 scope (see header note).

      return created;
    });

    const session = await issueSession(user, req);

    return created({
      message: t(input.locale, "SIGNUP_SUCCESS"),
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        locale: user.locale,
        referralCode: user.referralCode,
      },
      session,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
