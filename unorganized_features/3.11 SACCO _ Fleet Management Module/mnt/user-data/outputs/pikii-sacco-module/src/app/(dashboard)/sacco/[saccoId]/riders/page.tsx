// src/app/(dashboard)/sacco/[saccoId]/riders/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSaccoRiders } from "@/lib/sacco/queries";
import { getSaccoZones } from "@/lib/sacco/queries";
import RidersTable from "@/components/sacco/RidersTable";

interface PageProps {
  params: { saccoId: string };
}

export default async function SaccoRidersPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [riders, zones] = await Promise.all([
    getSaccoRiders(params.saccoId),
    getSaccoZones(params.saccoId),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rider Roster</h1>
        <p className="text-sm text-gray-500 mt-1">
          {riders.length} riders · manage commission, zones, and documents
        </p>
      </div>
      <RidersTable
        initialRiders={riders}
        zones={zones}
        saccoId={params.saccoId}
      />
    </div>
  );
}
