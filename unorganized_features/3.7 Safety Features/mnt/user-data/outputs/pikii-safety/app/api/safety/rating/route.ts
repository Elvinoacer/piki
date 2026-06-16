// app/api/safety/rating/route.ts
// POST /api/safety/rating — submit a post-trip rating.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { submitRating } from "@/lib/safety/safety.service";
import { z } from "zod";

const schema = z.object({
  tripId: z.string(),
  toUserId: z.string(),
  score: z.number().int().min(1).max(5),
  tags: z.array(z.string()).max(6),
  comment: z.string().max(500).optional(),
  direction: z.enum(["CLIENT_TO_RIDER", "RIDER_TO_CLIENT"]),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  // Guard: prevent self-rating.
  if (parsed.data.toUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot rate yourself." }, { status: 422 });
  }

  const rating = await submitRating(session.user.id, parsed.data);
  return NextResponse.json(rating, { status: 201 });
}
