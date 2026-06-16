import { NextRequest } from "next/server";
import { otpVerifySchema } from "@/lib/validation/auth";
import { verifyOtp } from "@/lib/otp/otp-service";
import { prisma } from "@/lib/prisma";
import { ok, errorResponse, resolveLocale } from "@/lib/api-response";

// =====================================================================================
// POST /api/auth/otp/verify
// -------------------------------------------------------------------------------------
// Body: { phone: string, purpose: OtpPurpose, code: string }
//
// Verifies the OTP code for (phone, purpose). On success, returns an opaque
// `verificationToken` that must be presented to:
//   - POST /api/auth/signup       (purpose=SIGNUP)
//   - POST /api/auth/login        (purpose=LOGIN)
//
// The token is single-use and expires after OTP_TTL_SECONDS from the moment
// of verification (see otp-service.verifyOtpVerificationToken).
//
// Errors: 400 OTP_EXPIRED | OTP_INVALID | OTP_TOO_MANY_ATTEMPTS
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const body = await req.json();
    const { phone, purpose, code } = otpVerifySchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { phone },
      select: { locale: true },
    });
    const effectiveLocale = existingUser?.locale ?? locale;

    const { verificationToken } = await verifyOtp(phone, purpose, code, effectiveLocale);

    return ok({ verificationToken, phone });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
