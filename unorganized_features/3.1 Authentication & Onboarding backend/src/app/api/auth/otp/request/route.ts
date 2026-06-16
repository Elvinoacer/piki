import { NextRequest } from "next/server";
import { otpRequestSchema } from "@/lib/validation/auth";
import { requestOtp } from "@/lib/otp/otp-service";
import { prisma } from "@/lib/prisma";
import { ok, created, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";

// =====================================================================================
// POST /api/auth/otp/request
// -------------------------------------------------------------------------------------
// Body: { phone: string, purpose: "SIGNUP" | "LOGIN" | "PHONE_CHANGE" | "PASSWORD_RESET" }
//
// Sends a 6-digit OTP via SMS to the given Kenyan phone number. Phone is
// normalized to E.164 server-side.
//
// Purpose-specific pre-checks:
//   - SIGNUP: 409 PHONE_ALREADY_REGISTERED if an account already exists.
//   - LOGIN / PHONE_CHANGE / PASSWORD_RESET: 404 ACCOUNT_NOT_FOUND if no
//     account exists for this phone (prevents leaking OTPs to numbers with
//     no account — though note this *does* confirm account existence; if
//     stricter privacy is required, switch to a generic 200 regardless and
//     silently skip sending).
//
// Rate limiting / cooldown errors surface as 429 with codes
// OTP_RATE_LIMITED / OTP_COOLDOWN (see otp-service.ts).
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const body = await req.json();
    const { phone, purpose } = otpRequestSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, locale: true },
    });

    if (purpose === "SIGNUP" && existingUser) {
      throw new ApiError(409, "PHONE_ALREADY_REGISTERED", locale);
    }

    if (purpose !== "SIGNUP" && !existingUser) {
      throw new ApiError(404, "ACCOUNT_NOT_FOUND", locale);
    }

    const effectiveLocale = existingUser?.locale ?? locale;

    const { expiresAt } = await requestOtp(phone, purpose, effectiveLocale);

    return created({
      message: t(effectiveLocale, "OTP_SENT"),
      expiresAt,
      // Echo back the normalized phone so the client's verify request uses
      // the exact same value (avoids E.164/local-format mismatches).
      phone,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
