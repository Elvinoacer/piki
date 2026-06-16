import { createRemoteJWKSet, jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

// -------------------------------------------------------------------------------------
// Google OAuth — ID Token Verification
// -------------------------------------------------------------------------------------
// Verifies a Google ID token (JWT) obtained client-side via Google Identity
// Services ("Sign in with Google" button). Per 3.1: "Social login (Google)
// for clients" — this module performs verification only; account
// creation/linking is handled by the calling route.
// -------------------------------------------------------------------------------------

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUER_1 = "https://accounts.google.com";
const GOOGLE_ISSUER_2 = "accounts.google.com";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  }
  return jwks;
}

export interface GoogleIdTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

/**
 * Verifies a Google-issued ID token: signature (via Google's published
 * JWKS), issuer, audience (must match GOOGLE_CLIENT_ID), and expiry.
 *
 * @throws if the token is invalid, expired, or has the wrong audience/issuer.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  const { GOOGLE_CLIENT_ID } = getEnv();
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer: [GOOGLE_ISSUER_1, GOOGLE_ISSUER_2],
    audience: GOOGLE_CLIENT_ID,
  });

  return payload as unknown as GoogleIdTokenPayload;
}
