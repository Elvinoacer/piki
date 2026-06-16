// app/api/safety/trip-sharing/route.ts
// POST /api/safety/trip-sharing        — create/refresh a share link.
// GET  /api/safety/trip-sharing?token= — public view (no auth required).

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createTripShareLink,
  getTripSharePublicView,
} from "@/lib/safety/safety.service";
import { z } from "zod";

const createSchema = z.object({ tripId: z.string() });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const link = await createTripShareLink(parsed.data.tripId);
  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/track/${link.token}`;

  return NextResponse.json({ token: link.token, shareUrl, expiresAt: link.expiresAt }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const view = await getTripSharePublicView(token);
  if (!view) {
    return NextResponse.json({ error: "Link expired or not found." }, { status: 404 });
  }

  return NextResponse.json(view);
}
