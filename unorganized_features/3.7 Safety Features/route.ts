// app/api/safety/sos/route.ts
// POST /api/safety/sos — trigger SOS from an active trip.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { triggerSos } from "@/lib/safety/safety.service";
import { sendSosSmsBatch } from "@/lib/safety/sms.service";
import { broadcastSosToSafetyTeam } from "@/lib/safety/realtime.service";
import { z } from "zod";

const schema = z.object({
  tripId: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 400 });
  }

  const { sosEvent, trustedContacts } = await triggerSos(session.user.id, parsed.data);

  const mapUrl = `https://maps.google.com/?q=${parsed.data.latitude},${parsed.data.longitude}`;

  // Fire-and-forget: SMS trusted contacts + notify safety team.
  await Promise.allSettled([
    sendSosSmsBatch(
      trustedContacts.map((c) => c.phone),
      `🆘 ${session.user.name ?? "Someone you know"} triggered an emergency on Pikii. Live location: ${mapUrl}`
    ),
    broadcastSosToSafetyTeam({ sosEventId: sosEvent.id, userId: session.user.id, mapUrl }),
  ]);

  return NextResponse.json({ sosEventId: sosEvent.id }, { status: 201 });
}
