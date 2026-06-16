/**
 * lib/websocket/auth.ts
 *
 * Verify a JWT (issued by NextAuth) for Socket.IO connections.
 * The client passes the session token via socket.handshake.auth.token.
 */

import { verifyAccessToken } from "@/lib/auth/tokens";

interface SocketUser {
  id: string;
  role: string;
}

/**
 * Verify a custom access token string.
 * Used in Socket.IO auth middleware (lib/websocket/server.ts).
 */
export async function verifySocketToken(token: string): Promise<SocketUser> {
  try {
    const payload = await verifyAccessToken(token);

    if (!payload?.sub) {
      throw new Error("Invalid or expired token");
    }

    return {
      id:   payload.sub,
      role: payload.role ?? "CLIENT",
    };
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}
