import { redirect } from "next/navigation";
import { getServerAuth } from "@/lib/auth/session";
import { getRiderDashboardData } from "@/lib/api/riderDashboard";
import { RiderDashboardClient } from "./RiderDashboardClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"; // fresh data on every request
export const metadata = { title: "Dashboard — Pikii Rider" };

export default async function RiderDashboardPage() {
  const payload = await getServerAuth();

  // Auth guard — redirect to login if not a rider
  if (!payload || payload.role !== "RIDER") {
    redirect("/login?next=/dashboard");
  }

  const profile = await prisma.riderProfile.findUnique({
    where: { userId: payload.sub }
  });

  if (!profile) {
    redirect("/login?next=/dashboard");
  }

  const data = await getRiderDashboardData(profile.id);

  return <RiderDashboardClient initialData={data} riderId={profile.id} />;
}
