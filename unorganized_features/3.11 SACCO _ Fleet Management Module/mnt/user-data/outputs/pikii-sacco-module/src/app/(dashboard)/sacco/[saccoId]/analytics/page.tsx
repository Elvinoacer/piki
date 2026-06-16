// src/app/(dashboard)/sacco/[saccoId]/analytics/page.tsx
// Fleet-wide analytics dashboard — server component

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getFleetAnalytics } from "@/lib/sacco/queries";
import AnalyticsDashboard from "@/components/sacco/AnalyticsDashboard";

interface PageProps {
  params: { saccoId: string };
  searchParams: { period?: string };
}

export default async function SaccoAnalyticsPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const period = (["today", "week", "month"].includes(
    searchParams.period ?? ""
  )
    ? searchParams.period
    : "week") as "today" | "week" | "month";

  const analytics = await getFleetAnalytics(params.saccoId, period);

  const sacco = await prisma.saccoOrg.findUnique({
    where: { id: params.saccoId },
    select: { name: true },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fleet Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Performance overview for {sacco?.name}
        </p>
      </div>
      <AnalyticsDashboard
        data={analytics}
        saccoId={params.saccoId}
        activePeriod={period}
      />
    </div>
  );
}
