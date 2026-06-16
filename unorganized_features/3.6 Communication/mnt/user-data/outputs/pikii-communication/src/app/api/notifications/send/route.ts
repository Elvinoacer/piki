// src/app/api/notifications/send/route.ts
// POST /api/notifications/send
// Internal endpoint called by trip status transitions, BullMQ workers, etc.
// Protected by the internal API secret (not exposed to the public).

import { NextRequest, NextResponse } from "next/server";
import { dispatchNotification } from "@/lib/notification-dispatcher";
import type { SendNotificationPayload, StatusMessageContext } from "@/types/communication";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = (await req.json()) as SendNotificationPayload & { ctx?: StatusMessageContext };

  if (!body.userId || !body.type) {
    return NextResponse.json({ error: "userId and type are required" }, { status: 400 });
  }

  try {
    await dispatchNotification(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify/send] Error:", err);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
