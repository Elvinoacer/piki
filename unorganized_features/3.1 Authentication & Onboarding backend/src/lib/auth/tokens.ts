import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { getEnv } from "@/lib/env";
import type { UserRole } from "@prisma/client";

// -------------------------------------------------------------------------------------
// Session / Token Helpers
// -------------------------------------------------------------------------------------
// Access tokens: short-lived JWTs (HS256 via `jose`, Edge-runtime compatible),
//   carrying { sub: userId, role, status, locale }.
// Refresh tokens: opaque random strings. The RAW value is returned to the
//   client exactly once (at issuance); only its SHA-256 hash is stored in
//   the RefreshToken table (see prisma/schema/auth.prisma).
// -------------------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub: string; // userId
  role: UserRole;
  locale: "EN" | "SW";
}

function accessSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_ACCESS_SECRET);
}

/**
 * Signs a short-lived access token for the given user.
 */
export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const { ACCESS_TOKEN_TTL_SECONDS } = getEnv();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS)
    .setSubject(payload.sub)
    .sign(accessSecretKey());
}

/**
 * Verifies and decodes an access token. Throws if invalid/expired.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecretKey());
  return payload as unknown as AccessTokenPayload;
}

/**
 * Generates a new opaque refresh token (raw value to send to the client) and
 * its SHA-256 hash (to store in the database).
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("base64url");
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

/**
 * Hashes a raw refresh token for lookup/storage. Deterministic so the raw
 * value presented by the client can be hashed and compared against
 * RefreshToken.tokenHash.
 */
export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Returns the Date at which a freshly-issued refresh token should expire,
 * based on REFRESH_TOKEN_TTL_SECONDS.
 */
export function refreshTokenExpiry(): Date {
  const { REFRESH_TOKEN_TTL_SECONDS } = getEnv();
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}
