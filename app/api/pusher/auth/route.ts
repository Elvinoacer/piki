import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getPusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    const payload = await requireAuth(req as any);
    userId = payload.sub;
  } catch {
    return NextResponse.json({}, { status: 401 });
  }

  const data = await req.text();
  const params = new URLSearchParams(data);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
  }

  // Authorise only channels the user owns
  const allowed =
    channelName === `private-notify-${userId}` ||
    channelName.startsWith("private-chat-");

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const authResponse = getPusherServer().authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
