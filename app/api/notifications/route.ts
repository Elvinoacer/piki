import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const { id } = await req.json();

  if (id) {
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
