import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshSchema } from "@/lib/validation/auth";
import { hashRefreshToken } from "@/lib/auth/tokens";
import { ok, errorResponse, resolveLocale } from "@/lib/api-response";
import { t } from "@/lib/i18n/messages";
import { requireAuth } from "@/lib/auth/session";

// =====================================================================================
// POST /api/auth/logout
// -------------------------------------------------------------------------------------
// Body: { refreshToken: string }
// Header: Authorization: Bearer <accessToken>  (required — confirms the
//         caller controls the session being terminated)
//
// Revokes the given refresh token (idempotent — revoking an already-revoked
// or unknown token still returns 200, since the end state — "this token
// cannot be used" — is already true).
//
// Note: the short-lived access token itself cannot be revoked (stateless
// JWT) and will remain valid until it naturally expires
// (ACCESS_TOKEN_TTL_SECONDS). Clients should discard it locally immediately.
// =====================================================================================

export async function POST(req: NextRequest) {
  const locale = resolveLocale(req.headers.get("x-locale"));

  try {
    const payload = await requireAuth(req);
    const { refreshToken } = refreshSchema.parse(await req.json());
    const tokenHash = hashRefreshToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash, userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return ok({ message: t(payload.locale, "LOGOUT_SUCCESS") });
  } catch (err) {
    return errorResponse(err, locale);
  }
}
