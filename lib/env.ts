import { z } from "zod";

// -------------------------------------------------------------------------------------
// Environment Variable Validation
// -------------------------------------------------------------------------------------
// Parsed once at module load. Throws early (at boot / first import) rather than
// failing deep inside a request handler with a confusing "undefined" error.
// -------------------------------------------------------------------------------------

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  APP_ENCRYPTION_KEY: z.string().min(16),

  OTP_HASH_SECRET: z.string().min(16),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(60),
  OTP_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(5),

  AFRICASTALKING_API_KEY: z.string().optional().default(""),
  AFRICASTALKING_USERNAME: z.string().optional().default(""),
  AFRICASTALKING_SENDER_ID: z.string().optional().default("PIKII"),
  AFRICASTALKING_ENV: z.enum(["sandbox", "production"]).default("sandbox"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default(""),

  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("auto"),
  S3_BUCKET_NAME: z.string().optional().default("pikii-rider-documents"),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(600),

  AI_DOC_CHECK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  AI_DOC_CHECK_PROVIDER_URL: z.string().optional().default(""),
  AI_DOC_CHECK_API_KEY: z.string().optional().default(""),

  REDIS_URL: z.string().optional().default("redis://localhost:6379"),

  NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "sw"]).default("en"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Returns validated environment variables. Lazily parsed + cached so that
 * importing this module in environments without a full .env (e.g. some
 * build steps) doesn't crash unless the values are actually used.
 */
export function getEnv(): Env {
  if (!cached) {
    cached = envSchema.parse(process.env);
  }
  return cached;
}
