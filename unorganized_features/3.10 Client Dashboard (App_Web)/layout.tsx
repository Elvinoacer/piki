import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientDashboardNav } from "@/components/client-dashboard/ClientDashboardNav";

export const metadata: Metadata = {
  title: "Pikii — Dashboard",
  description: "Book a ride or delivery",
};

export default async function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) redirect("/login");
  if (session.user.role !== "CLIENT") redirect("/rider/dashboard");

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-gray-50 lg:flex-row">
      {/* Sidebar nav (desktop) / Bottom tab bar (mobile) */}
      <ClientDashboardNav user={session.user} />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
    </div>
  );
}
