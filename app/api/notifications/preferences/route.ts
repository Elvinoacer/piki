import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const payload = await requireAuth(req as any);
    userId = payload.sub;
  } catch {
    return NextResponse.json({}, { status: 401 });
  }

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  return NextResponse.json({ preferences: prefs });
}

export async function PUT(req: NextRequest) {
  let userId: string;
  try {
    const payload = await requireAuth(req as any);
    userId = payload.sub;
  } catch {
    return NextResponse.json({}, { status: 401 });
  }

  const body = await req.json();

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    update: { ...body },
    create: { userId, ...body },
  });

  return NextResponse.json({ preferences: prefs });
}
