import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/validation/phone";

// -------------------------------------------------------------------------------------
// Auth Validation Schemas
// -------------------------------------------------------------------------------------

/**
 * Reusable phone field: accepts common Kenyan formats, transforms to E.164.
 * Refines to ensure the result is a plausible Kenyan mobile number.
 */
const kenyanPhone = z
  .string()
  .min(9, "Phone number is too short.")
  .max(15, "Phone number is too long.")
  .transform((val) => normalizeKenyanPhone(val))
  .refine((val): val is string => val !== null, {
    message: "Please enter a valid Kenyan phone number.",
  });

export const otpRequestSchema = z.object({
  phone: kenyanPhone,
  purpose: z.enum(["SIGNUP", "LOGIN", "PHONE_CHANGE", "PASSWORD_RESET"]),
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: kenyanPhone,
  purpose: z.enum(["SIGNUP", "LOGIN", "PHONE_CHANGE", "PASSWORD_RESET"]),
  code: z
    .string()
    .regex(/^\d{4,8}$/, "Code must be numeric."),
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

/**
 * Signup payload. `otpVerificationToken` is a short-lived token issued by
 * /api/auth/otp/verify (purpose=SIGNUP) proving the phone was confirmed,
 * preventing account creation with an unverified phone number.
 */
export const signupSchema = z.object({
  phone: kenyanPhone,
  otpVerificationToken: z.string().min(10),
  role: z.enum(["CLIENT", "RIDER", "SACCO_ADMIN"]),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  email: z.string().email().max(255).optional(),
  locale: z.enum(["EN", "SW"]).default("EN"),
  referralCode: z.string().min(3).max(32).optional(),
  acceptedTerms: z.literal(true, {
    error: "You must accept the Terms of Service.",
  }),
  acceptedPrivacy: z.literal(true, {
    error: "You must accept the Privacy Policy.",
  }),
  marketingOptIn: z.boolean().default(false),
  /// For RIDER role, optionally link to a SACCO at signup (pending approval).
  saccoId: z.string().cuid().optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Login via phone + OTP (passwordless — the default for Kenyan numbers).
 * `otpVerificationToken` proves the OTP for purpose=LOGIN was verified.
 */
export const loginWithOtpSchema = z.object({
  phone: kenyanPhone,
  otpVerificationToken: z.string().min(10),
});
export type LoginWithOtpInput = z.infer<typeof loginWithOtpSchema>;

/**
 * Optional fallback login via phone + password, for users who set a
 * password (e.g. SACCO Admins logging in from a desktop dashboard).
 */
export const loginWithPasswordSchema = z.object({
  phone: kenyanPhone,
  password: z.string().min(8).max(128),
});
export type LoginWithPasswordInput = z.infer<typeof loginWithPasswordSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const googleLoginSchema = z.object({
  /// Google ID token (JWT) obtained client-side via Google Identity Services.
  idToken: z.string().min(20),
  locale: z.enum(["EN", "SW"]).default("EN"),
  referralCode: z.string().min(3).max(32).optional(),
  acceptedTerms: z.literal(true).optional(),
  acceptedPrivacy: z.literal(true).optional(),
});
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
