// app/api/compliance/consent/route.ts
// GET  /api/compliance/consent        — fetch current consent
// PUT  /api/compliance/consent        — update consent preferences

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateRequiredConsent, type UserConsent } from "@/lib/compliance/dpa";
import { headers } from "next/headers";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const consent = await prisma.userConsent.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json(consent ?? { location: false, marketing: false, analytics: false });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Partial<UserConsent>;

  if (!validateRequiredConsent(body)) {
    return NextResponse.json(
      { error: "Location consent is required for Pikii to function." },
      { status: 422 }
    );
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ??
    (await headers()).get("x-real-ip") ??
    "unknown";

  const consent = await prisma.userConsent.upsert({
    where: { userId: session.user.id },
    update: {
      location: body.location ?? false,
      marketing: body.marketing ?? false,
      analytics: body.analytics ?? false,
      ipAddress: ip,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      location: body.location ?? false,
      marketing: body.marketing ?? false,
      analytics: body.analytics ?? false,
      ipAddress: ip,
    },
  });

  return NextResponse.json(consent);
}
