// app/api/safety/check-in/route.ts
// POST /api/safety/check-in           — rider/client responds "I'm safe".
// POST /api/safety/check-in/send      — internal / job-triggered: send check-in for a trip.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createNightCheckIn,
  respondToCheckIn,
  isNightHour,
} from "@/lib/safety/safety.service";
import { z } from "zod";

const respondSchema = z.object({ checkInId: z.string() });
const sendSchema = z.object({ tripId: z.string(), userId: z.string() });

export async function POST(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Send check-in (triggered by background job or trip-start hook) ──────────
  if (pathname.endsWith("/send")) {
    // Secured by internal secret, not user session.
    const secret = req.headers.get("x-internal-secret");
    if (secret !== process.env.INTERNAL_JOB_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    if (!isNightHour()) {
      return NextResponse.json({ skipped: true, reason: "Not night hours." });
    }

    const checkIn = await createNightCheckIn(parsed.data.tripId, parsed.data.userId);
    return NextResponse.json(checkIn, { status: 201 });
  }

  // ── User responds to a check-in ───────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const updated = await respondToCheckIn(parsed.data.checkInId);
  return NextResponse.json(updated);
}
