// app/(dashboard)/settings/compliance/page.tsx
// Compliance & Localization settings page.
// Tabs: Language | Documents | Tax Records | Privacy
// Only visible to authenticated users; NTSA docs tab only visible to riders.

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ComplianceSettingsClient } from "./ComplianceSettingsClient";

export const metadata = {
  title: "Compliance & Localization — Pikii",
};

export default async function ComplianceSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <ComplianceSettingsClient userRole={session.user.role} />
    </div>
  );
}
