// app/api/rider/status/route.ts
// PATCH /api/rider/status — toggle online/offline/break

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // your NextAuth config
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.riderId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();
  const validStatuses = ["AVAILABLE", "ON_TRIP", "BREAK", "OFFLINE"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  await prisma.riderProfile.update({
    where: { id: session.user.riderId },
    data: { status, lastSeenAt: new Date() },
  });

  return NextResponse.json({ status });
}
