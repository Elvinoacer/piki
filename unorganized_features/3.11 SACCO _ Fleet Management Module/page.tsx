// src/app/(dashboard)/sacco/[saccoId]/page.tsx
// Root SACCO route — redirects to analytics

import { redirect } from "next/navigation";

interface PageProps {
  params: { saccoId: string };
}

export default function SaccoRootPage({ params }: PageProps) {
  redirect(`/sacco/${params.saccoId}/analytics`);
}
