import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getRiderDashboardData } from "@/lib/api/riderDashboard";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const payload = await requireAuth(req);
    if (payload.role !== "RIDER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const profile = await prisma.riderProfile.findUnique({
      where: { userId: payload.sub }
    });

    if (!profile) {
      return NextResponse.json({ message: "Rider profile not found" }, { status: 404 });
    }

    const data = await getRiderDashboardData(profile.id);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    console.error("[/api/rider/dashboard] error:", err);
    return NextResponse.json(
      { message: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
