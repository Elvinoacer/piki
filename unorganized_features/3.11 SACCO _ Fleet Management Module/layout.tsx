// src/app/(dashboard)/sacco/layout.tsx
// Shell layout for all SACCO admin pages — sidebar + header

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import SaccoSidebar from "@/components/sacco/SaccoSidebar";

interface Props {
  children: React.ReactNode;
  params: { saccoId?: string };
}

export default async function SaccoLayout({ children }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  // Find the SACCO this admin belongs to
  const membership = await prisma.saccoAdmin.findFirst({
    where: { userId: session.user.id },
    include: { sacco: true },
  });

  if (!membership) redirect("/");

  const { sacco } = membership;

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <SaccoSidebar
        saccoId={sacco.id}
        saccoName={sacco.name}
        adminRole={membership.role}
      />
      <main className="flex-1 min-w-0 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
