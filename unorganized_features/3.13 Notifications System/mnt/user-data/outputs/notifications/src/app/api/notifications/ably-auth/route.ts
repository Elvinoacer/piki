import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/notifications/ably-auth
 *
 * Issues a short-lived Ably token request scoped to the requesting user's
 * channel. The client Ably SDK (useNotifications.ts, subscribeViaAbly) calls
 * this as its `authUrl`. The token grants subscribe-only access to
 * `user-{userId}` so clients can never publish to other users' channels.
 *
 * Required env var: ABLY_API_KEY  (format: "appId.keyId:keySecret")
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Ably API key not configured" }, { status: 500 });
  }

  const [keyName, keySecret] = apiKey.split(":");
  if (!keyName || !keySecret) {
    return NextResponse.json({ error: "Malformed ABLY_API_KEY" }, { status: 500 });
  }

  const userId = session.user.id;
  const channelName = `user-${userId}`;

  // Token request signed with the key secret, scoped to subscribe on exactly
  // this user's channel. TTL 1 hour — the Ably SDK will call authUrl again
  // before it expires if the connection stays open.
  const tokenRequest = {
    keyName,
    ttl: 3_600_000, // 1 hour in milliseconds
    capability: JSON.stringify({ [channelName]: ["subscribe"] }),
    clientId: userId,
    timestamp: Date.now(),
    nonce: crypto.randomUUID().replace(/-/g, ""),
  };

  // Sign the token request using HMAC-SHA256
  const signature = await signTokenRequest(tokenRequest, keySecret);
  const signedRequest = { ...tokenRequest, mac: signature };

  return NextResponse.json(signedRequest);
}

/**
 * Signs an Ably token request per the REST token-request spec:
 * https://ably.com/docs/core-features/authentication#token-request-spec
 */
async function signTokenRequest(
  tokenRequest: {
    keyName: string;
    ttl: number;
    capability: string;
    clientId: string;
    timestamp: number;
    nonce: string;
  },
  keySecret: string,
): Promise<string> {
  // Message to sign: newline-separated fields in canonical order.
  const message = [
    tokenRequest.keyName,
    tokenRequest.ttl,
    tokenRequest.capability,
    tokenRequest.clientId,
    tokenRequest.timestamp,
    tokenRequest.nonce,
    "", // trailing newline required by Ably spec
  ].join("\n");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));

  // Base64-encode the raw signature bytes
  const bytes = new Uint8Array(sig);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}
