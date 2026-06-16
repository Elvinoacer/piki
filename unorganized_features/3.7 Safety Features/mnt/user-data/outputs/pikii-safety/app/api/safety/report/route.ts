// app/api/safety/report/route.ts
// POST /api/safety/report         — file a report against a user.
// POST /api/safety/report/block   — block a user.
// DELETE /api/safety/report/block — unblock a user.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitReport, blockUser, unblockUser } from "@/lib/safety/safety.service";
import { z } from "zod";

const reportSchema = z.object({
  reportedId: z.string(),
  tripId: z.string().optional(),
  reason: z.enum([
    "UNSAFE_DRIVING",
    "HARASSMENT",
    "WRONG_ROUTE",
    "OVERCHARGING",
    "FRAUD",
    "IMPERSONATION",
    "OTHER",
  ]),
  description: z.string().max(1000).optional(),
});

const blockSchema = z.object({ blockedId: z.string() });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { pathname } = req.nextUrl;

  if (pathname.endsWith("/block")) {
    const body = await req.json();
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    await blockUser(session.user.id, parsed.data.blockedId);
    return NextResponse.json({ blocked: true });
  }

  const body = await req.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const report = await submitReport(session.user.id, parsed.data);
  return NextResponse.json(report, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  await unblockUser(session.user.id, parsed.data.blockedId);
  return NextResponse.json({ unblocked: true });
}
