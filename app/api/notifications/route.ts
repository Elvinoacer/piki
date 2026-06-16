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

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    const payload = await requireAuth(req as any);
    userId = payload.sub;
  } catch {
    return NextResponse.json({}, { status: 401 });
  }

  const { id } = await req.json();

  if (id) {
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
