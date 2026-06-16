import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ preferences: prefs });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const body = await req.json();

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: { ...body },
    create: { userId: session.user.id, ...body },
  });

  return NextResponse.json({ preferences: prefs });
}
