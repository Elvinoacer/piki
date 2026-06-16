import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { sendOtpSms } from "@/lib/otp/sms-provider";
import { ApiError } from "@/lib/api-response";
import type { OtpPurpose, Locale } from "@/app/generated/prisma/client";

// -------------------------------------------------------------------------------------
// OTP Service
// -------------------------------------------------------------------------------------
// Implements 3.1 "Phone number (OTP via SMS)" with the security/operational
// requirements from section 5 (NFRs): rate-limiting, idempotent-friendly
// resend cooldown, hashed storage of codes, capped verification attempts.
// -------------------------------------------------------------------------------------

/** Generates a numeric OTP of OTP_LENGTH digits, e.g. "483920". */
function generateNumericCode(length: number): string {
  const max = 10 ** length;
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, "0");
}

/** HMAC-SHA256 hash of an OTP code, keyed by OTP_HASH_SECRET. */
function hashOtp(code: string, destination: string, purpose: OtpPurpose): string {
  const { OTP_HASH_SECRET } = getEnv();
  return crypto
    .createHmac("sha256", OTP_HASH_SECRET)
    .update(`${destination}:${purpose}:${code}`)
    .digest("hex");
}

/**
 * Requests a new OTP for `destination` (E.164 phone) + `purpose`.
 *
 * Enforces:
 *  - Resend cooldown (OTP_RESEND_COOLDOWN_SECONDS) — prevents rapid re-sends.
 *  - Hourly rate limit (OTP_RATE_LIMIT_PER_HOUR) — prevents SMS-bombing abuse.
 *
 * On success, persists a hashed OtpCode row and dispatches the SMS.
 *
 * @throws {ApiError} OTP_COOLDOWN | OTP_RATE_LIMITED
 */
export async function requestOtp(
  destination: string,
  purpose: OtpPurpose,
  locale: Locale = "EN" as Locale
): Promise<{ expiresAt: Date }> {
  const env = getEnv();
  const now = new Date();

  // --- Rate limit: hourly count -------------------------------------------------
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentCount = await prisma.otpCode.count({
    where: { destination, purpose, createdAt: { gte: oneHourAgo } },
  });
  if (recentCount >= env.OTP_RATE_LIMIT_PER_HOUR) {
    throw new ApiError(429, "OTP_RATE_LIMITED", locale);
  }

  // --- Cooldown: most recent request -------------------------------------------
  const lastOtp = await prisma.otpCode.findFirst({
    where: { destination, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastOtp) {
    const elapsedSeconds = (now.getTime() - lastOtp.createdAt.getTime()) / 1000;
    if (elapsedSeconds < env.OTP_RESEND_COOLDOWN_SECONDS) {
      throw new ApiError(429, "OTP_COOLDOWN", locale);
    }
  }

  // --- Generate + persist ---------------------------------------------------------
  const code = generateNumericCode(env.OTP_LENGTH);
  const codeHash = hashOtp(code, destination, purpose);
  const expiresAt = new Date(now.getTime() + env.OTP_TTL_SECONDS * 1000);

  // Look up an existing user for this destination (if any) so OtpCode.userId
  // can be set — useful for LOGIN/PHONE_CHANGE/PASSWORD_RESET purposes.
  const existingUser = await prisma.user.findUnique({
    where: { phone: destination },
    select: { id: true },
  });

  const providerMessageId = await sendOtpSms(destination, code, locale);

  await prisma.otpCode.create({
    data: {
      userId: existingUser?.id,
      destination,
      channel: "SMS",
      purpose,
      codeHash,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      expiresAt,
      providerMessageId,
    },
  });

  return { expiresAt };
}

export interface OtpVerificationResult {
  /// Short-lived opaque token proving this destination+purpose was verified.
  /// Must be presented to /api/auth/signup or /api/auth/login alongside the
  /// same phone+purpose to complete the flow. Stored as a one-time-use row
  /// keyed by its hash (re-using the OtpCode table's codeHash field with a
  /// distinguishing purpose-suffix would conflate concerns, so we instead
  /// mark the consumed OtpCode row itself and return its id as the token —
  /// see verifyOtpVerificationToken below).
  verificationToken: string;
}

/**
 * Verifies a submitted OTP code against the most recent unconsumed,
 * non-expired OtpCode for (destination, purpose).
 *
 * @throws {ApiError} OTP_EXPIRED | OTP_INVALID | OTP_TOO_MANY_ATTEMPTS
 */
export async function verifyOtp(
  destination: string,
  purpose: OtpPurpose,
  submittedCode: string,
  locale: Locale = "EN" as Locale
): Promise<OtpVerificationResult> {
  const now = new Date();

  const otp = await prisma.otpCode.findFirst({
    where: { destination, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp || otp.expiresAt < now) {
    throw new ApiError(400, "OTP_EXPIRED", locale);
  }

  if (otp.attempts >= otp.maxAttempts) {
    throw new ApiError(400, "OTP_TOO_MANY_ATTEMPTS", locale);
  }

  const submittedHash = hashOtp(submittedCode, destination, purpose);

  if (submittedHash !== otp.codeHash) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });

    const remaining = otp.maxAttempts - (otp.attempts + 1);
    if (remaining <= 0) {
      throw new ApiError(400, "OTP_TOO_MANY_ATTEMPTS", locale);
    }
    throw new ApiError(400, "OTP_INVALID", locale);
  }

  // Mark as consumed — this row's `id` doubles as the verification token.
  // Signup/login endpoints validate the token via verifyOtpVerificationToken.
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: now },
  });

  return { verificationToken: otp.id };
}

/**
 * Validates a verification token returned by {@link verifyOtp}. Confirms the
 * referenced OtpCode row was consumed (i.e. the OTP step was completed) for
 * the given destination+purpose, and that it was consumed recently enough to
 * still be trusted (within OTP_TTL_SECONDS of consumption — prevents replay
 * of very old tokens).
 *
 * @throws {ApiError} OTP_EXPIRED if the token is invalid, unconsumed, or stale.
 */
export async function verifyOtpVerificationToken(
  token: string,
  destination: string,
  purpose: OtpPurpose,
  locale: Locale = "EN" as Locale
): Promise<void> {
  const env = getEnv();

  const otp = await prisma.otpCode.findUnique({ where: { id: token } });

  if (!otp || otp.destination !== destination || otp.purpose !== purpose || !otp.consumedAt) {
    throw new ApiError(400, "OTP_EXPIRED", locale);
  }

  const ageSeconds = (Date.now() - otp.consumedAt.getTime()) / 1000;
  if (ageSeconds > env.OTP_TTL_SECONDS) {
    throw new ApiError(400, "OTP_EXPIRED", locale);
  }
}
