import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const registerSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios", "web"]),
});

/**
 * POST /api/notifications/push-tokens
 * Body: { token: string, platform: "android" | "ios" | "web" }
 *
 * Upserts the device's FCM token. Called on app start and whenever FCM
 * issues a new token (token rotation). `lastSeenAt` lets us prune stale
 * tokens for devices that haven't opened the app in a long time, separate
 * from FCM-reported-invalid pruning in fcm.ts.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { token, platform } = parsed.data;

  await prisma.pushToken.upsert({
    where: { token },
    create: { userId: session.user.id, token, platform },
    update: { userId: session.user.id, platform, lastSeenAt: new Date() },
  });

  return NextResponse.json({ success: true });
}

const unregisterSchema = z.object({ token: z.string().min(20) });

/**
 * DELETE /api/notifications/push-tokens
 * Body: { token: string }
 *
 * Called on logout / notification permission revoke so we stop sending
 * push to a device the user signed out of.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = unregisterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.pushToken.deleteMany({
    where: { token: parsed.data.token, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
