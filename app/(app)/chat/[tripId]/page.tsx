// src/app/(app)/chat/[tripId]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChatRoom } from "@/components/chat/ChatRoom";

interface PageProps {
  params: { tripId: string };
}

export default async function ChatPage({ params }: PageProps) {
  const { tripId } = params;

  // We only fetch the trip to ensure it exists and get status. 
  // Client component handles auth checks.
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!trip) notFound();

  // Active statuses that allow chat
  const CHAT_ACTIVE_STATUSES = ["ACCEPTED", "ARRIVING", "ARRIVED", "IN_PROGRESS"];
  const chatIsActive = CHAT_ACTIVE_STATUSES.includes(trip.status);

  return (
    <div className="h-[100dvh] flex flex-col">
      <ChatRoom tripId={tripId} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: `Trip Chat · Pikii`,
    description: "Secure masked chat for your Pikii trip",
  };
}
