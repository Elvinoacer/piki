// src/app/(dashboard)/sacco/[saccoId]/settings/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import SaccoSettingsForm from "@/components/sacco/SaccoSettingsForm";

interface PageProps {
  params: { saccoId: string };
}

export default async function SaccoSettingsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sacco = await prisma.saccoOrg.findUnique({
    where: { id: params.saccoId },
    select: {
      id: true,
      name: true,
      registrationNo: true,
      contactPhone: true,
      contactEmail: true,
      platformCommissionPct: true,
      saccoCommissionPct: true,
      payoutManagedBy: true,
    },
  });

  if (!sacco) redirect("/");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SACCO Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your organisation profile and default commission rules
        </p>
      </div>
      <SaccoSettingsForm
        saccoId={sacco.id}
        initialValues={{
          name: sacco.name,
          registrationNo: sacco.registrationNo ?? "",
          contactPhone: sacco.contactPhone ?? "",
          contactEmail: sacco.contactEmail ?? "",
          platformCommissionPct: String(sacco.platformCommissionPct),
          saccoCommissionPct: String(sacco.saccoCommissionPct),
          payoutManagedBy: sacco.payoutManagedBy,
        }}
      />
    </div>
  );
}
