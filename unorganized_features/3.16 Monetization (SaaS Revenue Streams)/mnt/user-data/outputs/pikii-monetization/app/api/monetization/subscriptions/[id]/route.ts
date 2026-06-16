// app/api/monetization/subscriptions/[id]/route.ts
// DELETE /api/monetization/subscriptions/:id  — cancel subscription
// GET    /api/monetization/subscriptions/:id  — fetch single subscription

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  cancelSubscription,
} from "@/lib/monetization/subscription-service";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { plan: true, invoices: { orderBy: { createdAt: "desc" } } },
  });

  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: { subscription: sub } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const immediate =
    req.nextUrl.searchParams.get("immediate") === "true";

  // Verify ownership (or admin)
  const sub = await prisma.subscription.findFirst({
    where: { id: params.id },
  });
  if (!sub) {
    return NextResponse.json(
      { error: "Subscription not found." },
      { status: 404 }
    );
  }
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = sub.userId === session.user.id || sub.saccoId === session.user.saccoId;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const updated = await cancelSubscription(params.id, immediate);
    return NextResponse.json({ data: { subscription: updated } });
  } catch (err: any) {
    console.error("[subscription DELETE]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to cancel subscription." },
      { status: 500 }
    );
  }
}
