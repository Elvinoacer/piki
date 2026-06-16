// app/(rider)/dashboard/page.tsx
// Rider Dashboard Page — SSR initial data + client hydration — PRD §3.9

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getRiderDashboardData } from "@/lib/api/riderDashboard";
import { RiderDashboardClient } from "./RiderDashboardClient";

export const dynamic = "force-dynamic"; // fresh data on every request
export const metadata = { title: "Dashboard — Pikii Rider" };

export default async function RiderDashboardPage() {
  const session = await getServerSession(authOptions);

  // Auth guard — redirect to login if not a rider
  if (!session?.user?.riderId) {
    redirect("/login?next=/dashboard");
  }

  const data = await getRiderDashboardData(session.user.riderId as string);

  return <RiderDashboardClient initialData={data} />;
}
