/**
 * lib/websocket/auth.ts
 *
 * Verify a JWT (issued by NextAuth) for Socket.IO connections.
 * The client passes the session token via socket.handshake.auth.token.
 */

import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

interface SocketUser {
  id: string;
  role: string;
}

/**
 * Verify a NextAuth session token string (from cookie or header).
 * Used in Socket.IO auth middleware (lib/websocket/server.ts).
 */
export async function verifySocketToken(token: string): Promise<SocketUser> {
  // next-auth/jwt's getToken works with a raw token string via the `raw` approach,
  // but for socket use it's easier to decode the JWT directly.
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not configured");

  // Decode without request context — supply token as-is
  // This uses next-auth's internal JWT decode
  const { decode } = await import("next-auth/jwt");
  const payload = (await decode({ token, secret })) as (JWT & { role?: string }) | null;

  if (!payload?.sub) {
    throw new Error("Invalid or expired token");
  }

  return {
    id:   payload.sub,
    role: (payload.role as string) ?? "CLIENT",
  };
}
