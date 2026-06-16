import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFareEstimate } from "@/app/(client)/dashboard/actions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const estimate = await getFareEstimate(body);
  return NextResponse.json(estimate);
}
