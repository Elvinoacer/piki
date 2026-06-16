// src/app/(dashboard)/sacco/[saccoId]/zones/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSaccoZones, getSaccoRiders } from "@/lib/sacco/queries";
import ZonesManager from "@/components/sacco/ZonesManager";

interface PageProps {
  params: { saccoId: string };
}

export default async function ZonesPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [zones, riders] = await Promise.all([
    getSaccoZones(params.saccoId),
    getSaccoRiders(params.saccoId),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zones & Stages</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign riders to specific service zones or stages
        </p>
      </div>
      <ZonesManager
        zones={zones}
        riders={riders}
        saccoId={params.saccoId}
      />
    </div>
  );
}
