import { NextRequest, NextResponse } from "next/server";
import { dispatchNotification } from "@/lib/notification-dispatcher";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    // In production, secure this endpoint to only be called by internal services
    // For example, verify an internal API key or AWS signature.
    
    await dispatchNotification(payload);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error dispatching notification:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
