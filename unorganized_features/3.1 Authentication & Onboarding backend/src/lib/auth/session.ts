import { NextRequest } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";
import type { UserRole, UserStatus } from "@prisma/client";

// -------------------------------------------------------------------------------------
// Session Resolution for Route Handlers
// -------------------------------------------------------------------------------------
// Reads the `Authorization: Bearer <accessToken>` header, verifies the JWT,
// and (optionally) loads a fresh copy of the user row for authorization
// checks that depend on current status/role (which can change between token
// issuance and use, e.g. an admin suspends the account mid-session).
// -------------------------------------------------------------------------------------

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface SessionUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  locale: AccessTokenPayload["locale"];
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Verifies the access token from the request and returns the decoded
 * payload. Throws {@link UnauthorizedError} if missing/invalid/expired.
 *
 * Use this for low-overhead checks where you don't need a DB hit (e.g. just
 * need the userId for a write).
 */
export async function requireAuth(req: NextRequest): Promise<AccessTokenPayload> {
  const token = extractBearerToken(req);
  if (!token) throw new UnauthorizedError("Missing access token.");

  try {
    return await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired access token.");
  }
}

/**
 * Like {@link requireAuth}, but also loads the current User row from the
 * database so status/role reflect the latest state (not just what was true
 * when the token was issued). Throws {@link UnauthorizedError} if the user
 * no longer exists or has been soft-deleted/banned.
 */
export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const payload = await requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true, locale: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    throw new UnauthorizedError("User not found.");
  }
  if (user.status === "BANNED" || user.status === "DEACTIVATED") {
    throw new ForbiddenError(`Account is ${user.status.toLowerCase()}.`);
  }

  return { id: user.id, role: user.role, status: user.status, locale: user.locale as AccessTokenPayload["locale"] };
}

/**
 * Asserts that the resolved session user has one of the allowed roles.
 * Throws {@link ForbiddenError} otherwise.
 */
export function assertRole(user: SessionUser, allowed: UserRole[]): void {
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError(`Requires role: ${allowed.join(" or ")}.`);
  }
}
