import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { googleLoginSchema } from "@/lib/validation/auth";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { generateUniqueReferralCode } from "@/lib/services/referral.service";
import { issueSession } from "@/lib/services/session.service";
import { ok, created, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/auth/google
// -------------------------------------------------------------------------------------
// Body: { idToken, locale?, referralCode?, acceptedTerms?, acceptedPrivacy? }
//
// Per 3.1: "Social login (Google) for clients." Verifies the Google ID
// token, then either:
//   - Links to an existing User (matched by OAuthAccount(provider=GOOGLE,
//     providerUserId=sub), or by verified email if no OAuthAccount exists
//     yet but a User with that email is found), and logs them in; OR
//   - Creates a new User with role=CLIENT + ClientProfile (first-time
//     Google sign-in = signup). For NEW accounts, `acceptedTerms` and
//     `acceptedPrivacy` are REQUIRED (must be true) since this is the
//     account-creation path; phone number can be added later via the
//     profile (PHONE_CHANGE OTP flow).
//
// IMPORTANT: Google sign-in only ever assigns role=CLIENT. If an existing
// account with a different role (RIDER/SACCO_ADMIN/etc.) attempts to link
// the same Google identity, this returns 403 GOOGLE_LOGIN_CLIENT_ONLY —
// riders/admins must use phone-OTP auth per 3.1.
//
// NOTE ON PHONE UNIQUENESS: Google sign-in does not provide a Kenyan phone
// number, and User.phone is a required unique field. New Google-only
// accounts are created with a placeholder-free NULL... however Prisma's
// `phone String @unique` (non-nullable) means we cannot insert NULL. To
// reconcile this without a schema migration mid-feature, new Google client
// accounts are created with a synthetic placeholder phone of the form
// `+000GOOGLE<sub-hash>` which is guaranteed unique and clearly
// non-dialable. The onboarding UI MUST prompt these users to add/verify a
// real Kenyan phone (via PHONE_CHANGE OTP) before they can book a ride
// (matching/SMS-fallback features depend on a real phone). This is flagged
// as `phoneIsPlaceholder: true` in the response so the frontend can show
// that prompt immediately.
// =====================================================================================

function placeholderPhoneFromSub(sub: string): string {
  // 12 hex chars from the sub's hash, prefixed distinctly from real Kenyan
  // numbers (+254...) so it can never collide and is trivially identifiable.
  const hash = crypto.createHash("sha256").update(sub).digest("hex").slice(0, 12);
  return `+000GOOGLE${hash}`;
}

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const input = googleLoginSchema.parse(await req.json());
    const googlePayload = await verifyGoogleIdToken(input.idToken);

    // --- 1. Existing OAuth link? --------------------------------------------------
    const existingLink = await prisma.oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider: "GOOGLE", providerUserId: googlePayload.sub } },
      include: { user: true },
    });

    if (existingLink) {
      if (existingLink.user.role !== "CLIENT") {
        throw new ApiError(403, "GOOGLE_LOGIN_CLIENT_ONLY", existingLink.user.locale);
      }
      if (existingLink.user.deletedAt) {
        throw new ApiError(404, "ACCOUNT_NOT_FOUND", locale);
      }
      if (existingLink.user.status === "SUSPENDED" || existingLink.user.status === "BANNED") {
        throw new ApiError(403, "ACCOUNT_SUSPENDED", existingLink.user.locale);
      }

      const session = await issueSession(existingLink.user, req);
      return ok({
        message: t(existingLink.user.locale, "LOGIN_SUCCESS"),
        user: serializeUser(existingLink.user),
        session,
        phoneIsPlaceholder: existingLink.user.phone.startsWith("+000GOOGLE"),
      });
    }

    // --- 2. Existing User by verified email, link new OAuthAccount ----------------
    if (googlePayload.email && googlePayload.email_verified) {
      const userByEmail = await prisma.user.findUnique({ where: { email: googlePayload.email } });

      if (userByEmail) {
        if (userByEmail.role !== "CLIENT") {
          throw new ApiError(403, "GOOGLE_LOGIN_CLIENT_ONLY", userByEmail.locale);
        }
        if (userByEmail.deletedAt) {
          throw new ApiError(404, "ACCOUNT_NOT_FOUND", locale);
        }

        await prisma.oAuthAccount.create({
          data: {
            userId: userByEmail.id,
            provider: "GOOGLE",
            providerUserId: googlePayload.sub,
            providerEmail: googlePayload.email,
          },
        });

        const session = await issueSession(userByEmail, req);
        return ok({
          message: t(userByEmail.locale, "LOGIN_SUCCESS"),
          user: serializeUser(userByEmail),
          session,
          phoneIsPlaceholder: userByEmail.phone.startsWith("+000GOOGLE"),
        });
      }
    }

    // --- 3. New signup via Google (CLIENT only) ------------------------------------
    if (!input.acceptedTerms || !input.acceptedPrivacy) {
      throw new ApiError(422, "VALIDATION_ERROR", input.locale);
    }

    const referralCode = await generateUniqueReferralCode();
    const now = new Date();

    let referredById: string | undefined;
    if (input.referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: input.referralCode },
        select: { id: true },
      });
      referredById = referrer?.id;
    }

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          phone: placeholderPhoneFromSub(googlePayload.sub),
          email: googlePayload.email,
          emailVerifiedAt: googlePayload.email_verified ? now : undefined,
          firstName: googlePayload.given_name,
          lastName: googlePayload.family_name,
          avatarUrl: googlePayload.picture,
          role: "CLIENT",
          status: "ACTIVE",
          locale: input.locale,
          referralCode,
          referredById,
          termsAcceptedAt: now,
          privacyAcceptedAt: now,
        },
      });

      await tx.clientProfile.create({ data: { userId: newUser.id } });

      await tx.oAuthAccount.create({
        data: {
          userId: newUser.id,
          provider: "GOOGLE",
          providerUserId: googlePayload.sub,
          providerEmail: googlePayload.email,
        },
      });

      return newUser;
    });

    const session = await issueSession(user, req);

    return created({
      message: t(user.locale, "SIGNUP_SUCCESS"),
      user: serializeUser(user),
      session,
      phoneIsPlaceholder: true,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}

function serializeUser(user: {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  locale: string;
  referralCode: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    locale: user.locale,
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl,
  };
}
