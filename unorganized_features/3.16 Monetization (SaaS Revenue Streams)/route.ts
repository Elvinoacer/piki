// app/api/monetization/subscriptions/route.ts
// GET  /api/monetization/subscriptions        — list available plans (+ current sub)
// POST /api/monetization/subscriptions        — activate a subscription

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listPlans,
  activateSubscription,
  getActiveSubscription,
} from "@/lib/monetization/subscription-service";

// GET — returns plans filtered by the caller's role, plus their current subscription
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const role = session.user.role as string | undefined; // e.g. "RIDER" | "CLIENT" | "SACCO"
  const targetRole = req.nextUrl.searchParams.get("role") ?? role;

  try {
    const [plans, currentSubscription] = await Promise.all([
      listPlans(targetRole ?? undefined),
      getActiveSubscription(session.user.id),
    ]);

    return NextResponse.json({ data: { plans, currentSubscription } });
  } catch (err) {
    console.error("[subscriptions GET]", err);
    return NextResponse.json(
      { error: "Failed to load subscription plans." },
      { status: 500 }
    );
  }
}

// POST — activate a plan (after M-Pesa payment has been confirmed)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await req.json();
  const { planId, saccoId, paymentRef } = body as {
    planId?: string;
    saccoId?: string;
    paymentRef?: string;
  };

  if (!planId) {
    return NextResponse.json({ error: "planId is required." }, { status: 400 });
  }
  if (!paymentRef) {
    return NextResponse.json(
      { error: "paymentRef is required (M-Pesa transaction ID)." },
      { status: 400 }
    );
  }

  try {
    const subscription = await activateSubscription({
      planId,
      userId: saccoId ? undefined : session.user.id,
      saccoId: saccoId ?? undefined,
      paymentRef,
    });

    return NextResponse.json({ data: { subscription } }, { status: 201 });
  } catch (err: any) {
    console.error("[subscriptions POST]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to activate subscription." },
      { status: 500 }
    );
  }
}
