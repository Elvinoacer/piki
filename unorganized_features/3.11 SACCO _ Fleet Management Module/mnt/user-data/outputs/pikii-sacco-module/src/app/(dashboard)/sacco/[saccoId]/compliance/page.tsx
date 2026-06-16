// src/app/(dashboard)/sacco/[saccoId]/compliance/page.tsx

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getComplianceReport } from "@/lib/sacco/queries";
import ComplianceReport from "@/components/sacco/ComplianceReport";

interface PageProps {
  params: { saccoId: string };
}

export default async function CompliancePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const report = await getComplianceReport(params.saccoId);

  const expired = report.filter((r) => r.overallStatus === "EXPIRED").length;
  const expiring = report.filter((r) => r.overallStatus === "EXPIRING_SOON").length;
  const missing = report.filter((r) => r.overallStatus === "MISSING").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compliance Report</h1>
        <p className="text-sm text-gray-500 mt-1">
          License and insurance status across your fleet
        </p>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryBadge label="Expired" count={expired} color="red" />
        <SummaryBadge label="Expiring soon" count={expiring} color="amber" />
        <SummaryBadge label="Docs missing" count={missing} color="purple" />
        <SummaryBadge
          label="Fully compliant"
          count={report.length - expired - expiring - missing}
          color="green"
        />
      </div>

      <ComplianceReport riders={report} saccoId={params.saccoId} />
    </div>
  );
}

function SummaryBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "red" | "amber" | "purple" | "green";
}) {
  const cls = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
    green: "bg-emerald-50 text-emerald-700",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${cls}`}>
      <span className="text-base font-bold">{count}</span>
      {label}
    </span>
  );
}
