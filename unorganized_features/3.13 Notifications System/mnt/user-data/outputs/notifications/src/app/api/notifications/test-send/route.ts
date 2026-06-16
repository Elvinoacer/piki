import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { triggerNotification } from "@/lib/notifications/dispatcher";
import { ALL_EVENTS } from "@/lib/notifications/events";

/**
 * POST /api/notifications/test-send
 *
 * Manually fires any notification event to any user. Intended for:
 *   - Admin "send test notification" button in the ops dashboard
 *   - Developer testing notification templates during integration
 *   - QA verifying channel delivery end-to-end
 *
 * BLOCKED IN PRODUCTION unless ENABLE_TEST_SEND=true is explicitly set —
 * a safeguard against accidental exposure of this endpoint.
 *
 * Authorization: ADMIN role required regardless of env.
 */

const testSendSchema = z.object({
  userId: z.string().cuid(),
  event: z.enum(ALL_EVENTS as [string, ...string[]]),
  /** Vars to pass to the template. If a var is missing the template will
   *  render the literal `{{varName}}` — useful for spotting gaps in QA. */
  vars: z.record(z.union([z.string(), z.number()])).default({}),
  locale: z.enum(["en", "sw"]).default("en"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_TEST_SEND !== "true"
  ) {
    return NextResponse.json(
      { error: "Test-send is disabled in production. Set ENABLE_TEST_SEND=true to enable." },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 });
  }

  const parsed = testSendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { userId, event, vars, locale } = parsed.data;

  const { notificationId } = await triggerNotification({
    userId,
    event: event as any,
    vars,
    locale,
    data: { isTestSend: true, triggeredByAdmin: session.user.id },
  });

  return NextResponse.json({
    success: true,
    notificationId,
    message: `Test notification "${event}" queued for user ${userId}. Check the notifications inbox and delivery logs.`,
  });
}
