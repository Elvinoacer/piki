// src/app/(dashboard)/sacco/[saccoId]/payouts/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getSaccoPayoutBatches,
  getRidersPendingPayout,
} from "@/lib/sacco/queries";
import prisma from "@/lib/prisma";
import PayoutsPanel from "@/components/sacco/PayoutsPanel";

interface PageProps {
  params: { saccoId: string };
}

export default async function PayoutsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sacco = await prisma.saccoOrg.findUnique({
    where: { id: params.saccoId },
    select: { payoutManagedBy: true },
  });

  const [batches, pendingRiders] = await Promise.all([
    getSaccoPayoutBatches(params.saccoId),
    sacco?.payoutManagedBy === "SACCO"
      ? getRidersPendingPayout(params.saccoId)
      : Promise.resolve([]),
  ]);

  const payoutManagedBy = sacco?.payoutManagedBy ?? "PLATFORM";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payout Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          {payoutManagedBy === "SACCO"
            ? "You manage disbursements for your riders."
            : "Payouts are processed automatically by Pikii."}
        </p>
      </div>
      <PayoutsPanel
        batches={batches}
        pendingRiders={pendingRiders}
        saccoId={params.saccoId}
        payoutManagedBy={payoutManagedBy}
      />
    </div>
  );
}
