// lib/safety/realtime.service.ts
// Broadcasts safety events over your WebSocket layer (Pusher / Ably / Socket.IO).
// Replace the Pusher calls with your chosen provider's equivalent.

import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

interface SosPayload {
  sosEventId: string;
  userId: string;
  mapUrl: string;
}

/** Notifies the platform safety team channel of a new SOS event. */
export async function broadcastSosToSafetyTeam(payload: SosPayload) {
  await pusher.trigger("private-safety-team", "sos.triggered", payload);
}

/** Pushes a night check-in prompt to the user's private channel. */
export async function pushCheckInToUser(userId: string, checkInId: string) {
  await pusher.trigger(`private-user-${userId}`, "checkin.requested", { checkInId });
}

/** Notifies the client's trip channel that live location has been shared. */
export async function broadcastTripShareCreated(tripId: string, shareUrl: string) {
  await pusher.trigger(`private-trip-${tripId}`, "trip.shared", { shareUrl });
}
