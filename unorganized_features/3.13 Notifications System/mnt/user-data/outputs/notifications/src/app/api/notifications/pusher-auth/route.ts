import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * POST /api/notifications/pusher-auth
 *
 * Authenticates a Pusher private channel subscription. The client-side
 * Pusher SDK (useNotifications.ts) hits this endpoint automatically when it
 * tries to subscribe to `private-user-{userId}`. We verify that the
 * requesting session owns the channel they're trying to join — so a client
 * can only ever subscribe to their own notification stream.
 *
 * Required env vars: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  // Authorization check: the requested channel must match the session user.
  // Channel format: private-user-{userId}
  const expectedChannel = `private-user-${session.user.id}`;
  if (channelName !== expectedChannel) {
    return NextResponse.json(
      { error: `Forbidden: channel "${channelName}" does not match your session` },
      { status: 403 },
    );
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER ?? "eu";

  if (!appId || !key || !secret) {
    console.error("Pusher credentials missing — cannot authenticate channel");
    return NextResponse.json({ error: "Realtime auth misconfigured" }, { status: 500 });
  }

  // Lazy-import pusher so this route doesn't pull it into unrelated bundles.
  const Pusher = (await import("pusher")).default;
  const pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
