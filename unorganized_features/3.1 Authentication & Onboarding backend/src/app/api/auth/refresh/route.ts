import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSchema } from "@/lib/validation/auth";
import {
  hashRefreshToken,
  signAccessToken,
  generateRefreshToken,
  refreshTokenExpiry,
} from "@/lib/auth/tokens";
import { ok, errorResponse, resolveLocale, ApiError } from "@/lib/api-response";
import { getEnv } from "@/lib/env";

// =====================================================================================
// POST /api/auth/refresh
// -------------------------------------------------------------------------------------
// Body: { refreshToken: string }
//
// Validates the refresh token (by hash lookup), checks it hasn't expired or
// been revoked, then ROTATES it: the old token is marked revoked +
// replacedByTokenId is set, and a brand-new refresh token + access token
// pair is issued. This rotation pattern detects token reuse (if a revoked
// token is presented again, it's a signal of token theft — callers may want
// to add alerting on that case, see comment below).
//
// Errors: 401 UNAUTHORIZED if token is missing, unknown, expired, or revoked.
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const { refreshToken } = refreshSchema.parse(await req.json());
    const tokenHash = hashRefreshToken(refreshToken);

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!existing) {
      throw new ApiError(401, "UNAUTHORIZED", locale);
    }

    if (existing.revokedAt) {
      // SECURITY: a previously-rotated (revoked) token was presented again —
      // possible token theft/replay. In production, consider revoking ALL
      // refresh tokens for this user and alerting them. Left as a follow-up
      // hook rather than auto-implemented here to avoid surprising lockouts
      // during development/testing.
      throw new ApiError(401, "UNAUTHORIZED", locale);
    }

    if (existing.expiresAt < new Date()) {
      throw new ApiError(401, "UNAUTHORIZED", locale);
    }

    const user = existing.user;
    if (user.deletedAt || user.status === "BANNED" || user.status === "DEACTIVATED") {
      throw new ApiError(401, "UNAUTHORIZED", locale);
    }

    // --- Rotate -------------------------------------------------------------------
    const { raw: newRaw, hash: newHash } = generateRefreshToken();

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedByTokenId: newHash },
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newHash,
          expiresAt: refreshTokenExpiry(),
          userAgent: req.headers.get("user-agent") ?? undefined,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
        },
      }),
    ]);

    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      locale: user.locale as "EN" | "SW",
    });

    const { ACCESS_TOKEN_TTL_SECONDS } = getEnv();

    return ok({
      accessToken,
      refreshToken: newRaw,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
