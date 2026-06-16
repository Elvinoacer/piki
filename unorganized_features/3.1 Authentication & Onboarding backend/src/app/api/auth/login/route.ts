import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginWithOtpSchema, loginWithPasswordSchema } from "@/lib/validation/auth";
import { verifyOtpVerificationToken } from "@/lib/otp/otp-service";
import { issueSession } from "@/lib/services/session.service";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";
import bcrypt from "bcryptjs";

// =====================================================================================
// POST /api/auth/login
// -------------------------------------------------------------------------------------
// Supports two modes, distinguished by request body shape:
//
// 1. OTP login (primary, all roles):
//    Body: { phone, otpVerificationToken }
//    Requires a prior POST /api/auth/otp/verify with purpose=LOGIN.
//
// 2. Password login (fallback, e.g. SACCO Admin web dashboard):
//    Body: { phone, password }
//    Only succeeds if the user previously set a password (User.passwordHash).
//
// Both modes:
//   - 404 ACCOUNT_NOT_FOUND if phone has no account.
//   - 403 ACCOUNT_SUSPENDED if status is SUSPENDED or BANNED.
//   - On success, issues access + refresh tokens (see session.service).
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const body = await req.json();

    // Discriminate by presence of `otpVerificationToken` vs `password`.
    if ("otpVerificationToken" in body) {
      return await loginWithOtp(req, body, locale);
    }
    if ("password" in body) {
      return await loginWithPassword(req, body, locale);
    }

    throw new ApiError(422, "VALIDATION_ERROR", locale);
  } catch (err) {
    return errorResponse(err, locale);
  }
}

async function loginWithOtp(req: NextRequest, body: unknown, locale: import("@prisma/client").Locale) {
  const input = loginWithOtpSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user || user.deletedAt) {
    throw new ApiError(404, "ACCOUNT_NOT_FOUND", locale);
  }

  await verifyOtpVerificationToken(input.otpVerificationToken, input.phone, "LOGIN", user.locale);

  assertNotSuspended(user, locale);

  const session = await issueSession(user, req);

  return ok({
    message: t(user.locale, "LOGIN_SUCCESS"),
    user: serializeUser(user),
    session,
  });
}

async function loginWithPassword(req: NextRequest, body: unknown, locale: import("@prisma/client").Locale) {
  const input = loginWithPasswordSchema.parse(body);

  const user = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (!user || user.deletedAt || !user.passwordHash) {
    throw new ApiError(404, "ACCOUNT_NOT_FOUND", locale);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", user.locale);
  }

  assertNotSuspended(user, locale);

  const session = await issueSession(user, req);

  return ok({
    message: t(user.locale, "LOGIN_SUCCESS"),
    user: serializeUser(user),
    session,
  });
}

function assertNotSuspended(
  user: { status: string; locale: import("@prisma/client").Locale },
  fallbackLocale: import("@prisma/client").Locale
) {
  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", user.locale ?? fallbackLocale);
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
  };
}
