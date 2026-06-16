import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  generateRefreshToken,
  refreshTokenExpiry,
} from "@/lib/auth/tokens";
import type { User } from "@prisma/client";

// -------------------------------------------------------------------------------------
// Session Issuance
// -------------------------------------------------------------------------------------
// Shared by /api/auth/signup, /api/auth/login, /api/auth/google, and
// /api/auth/refresh — creates an access token + a new RefreshToken row, and
// updates User.lastLoginAt.
// -------------------------------------------------------------------------------------

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL, seconds
}

/**
 * Issues a fresh access + refresh token pair for `user`, persists the
 * refresh token (hashed), and updates lastLoginAt. Optionally records
 * device metadata from the request for session management/security.
 */
export async function issueSession(
  user: Pick<User, "id" | "role" | "locale">,
  req?: NextRequest
): Promise<IssuedSession> {
  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role,
    locale: user.locale as "EN" | "SW",
  });

  const { raw, hash } = generateRefreshToken();

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: refreshTokenExpiry(),
        userAgent: req?.headers.get("user-agent") ?? undefined,
        ipAddress: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  const { ACCESS_TOKEN_TTL_SECONDS } = (await import("@/lib/env")).getEnv();

  return { accessToken, refreshToken: raw, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}
