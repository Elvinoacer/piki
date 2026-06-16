// src/app/(app)/chat/[tripId]/page.tsx
// Server component — fetches session + trip ownership, then mounts ChatRoom client

import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatRoom } from "@/components/chat/ChatRoom";

interface PageProps {
  params: { tripId: string };
}

export default async function ChatPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const { tripId } = params;
  const userId = session.user.id;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      clientId: true,
      riderId: true,
      status: true,
    },
  });

  if (!trip) notFound();

  const isClient = trip.clientId === userId;
  const isRider = trip.riderId === userId;

  if (!isClient && !isRider) {
    // User is not a participant in this trip
    redirect("/dashboard");
  }

  // Active statuses that allow chat
  const CHAT_ACTIVE_STATUSES = ["ACCEPTED", "ARRIVING", "ARRIVED", "IN_PROGRESS"];
  const chatIsActive = CHAT_ACTIVE_STATUSES.includes(trip.status);

  // The "other party" label shown in the UI — no real names exposed
  const otherPartyLabel: "Rider" | "Client" = isClient ? "Rider" : "Client";

  return (
    <div className="h-[100dvh] flex flex-col">
      <ChatRoom
        tripId={tripId}
        currentUserId={userId}
        otherPartyLabel={otherPartyLabel}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  return {
    title: `Trip Chat · Pikii`,
    description: "Secure masked chat for your Pikii trip",
  };
}
