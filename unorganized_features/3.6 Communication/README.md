# Pikii Communication Feature — Integration Guide

## Files delivered

```
prisma/
  communication.prisma          ← Append to schema.prisma

src/
  types/
    communication.ts            ← All shared types

  lib/
    pusher/
      index.ts                  ← Pusher server + client singletons, channel/event helpers
      hooks.ts                  ← useChatChannel, useNotificationChannel (React hooks)
    fcm/
      index.ts                  ← Firebase Admin push dispatch
    africastalking/
      index.ts                  ← SMS send + optional voice masking
    notification-templates.ts   ← EN + SW message copy for every event type
    notification-dispatcher.ts  ← Core fan-out logic (DB + PUSH + SMS + Pusher)
    trip-events.ts              ← Integration glue — call from trip status transitions

  store/
    useCommunicationStore.ts    ← Zustand: useChatStore + useNotificationStore

  components/
    chat/
      ChatBubble.tsx            ← Single message rendering (system/mine/theirs)
      ChatInput.tsx             ← Auto-growing textarea + send button
      ChatHeader.tsx            ← Masked identity header + status pill
      ChatRoom.tsx              ← Full chat client (Pusher + pagination + optimistic UI)
    notifications/
      NotificationItem.tsx      ← Single notification row with icon + deep-link
      NotificationBell.tsx      ← Header bell icon + dropdown tray (10 recent)

  app/
    api/
      chat/[tripId]/
        route.ts                ← GET room info, DELETE (close room)
        messages/route.ts       ← GET paginated messages, POST send message
      notifications/
        route.ts                ← GET inbox, PATCH mark-read
        send/route.ts           ← POST internal dispatch endpoint
        preferences/route.ts    ← GET/PUT user notification preferences

    (app)/
      chat/[tripId]/page.tsx    ← Chat page (server component shell)
      notifications/
        page.tsx                ← Full notification inbox page
        preferences/page.tsx    ← Preferences settings page
```

---

## Setup steps

### 1. Prisma
Append `prisma/communication.prisma` contents to your `schema.prisma`, then:
```bash
npx prisma migrate dev --name add_communication
```

### 2. Create the SYSTEM user (seed)
The automated chat messages need a sender. Add to your seed:
```ts
await prisma.user.upsert({
  where: { email: 'system@pikii.app' },
  update: {},
  create: {
    email: 'system@pikii.app',
    name: 'Pikii',
    role: 'SYSTEM',
    // ...other required fields
  },
});
```
Copy the resulting `id` → `SYSTEM_USER_ID` in `.env.local`.

### 3. Install dependencies
```bash
npm install pusher pusher-js firebase-admin africastalking date-fns zustand immer
```

### 4. Environment variables
See `ENV_AND_DEPS.env` for all required vars.

### 5. Mount NotificationBell in your header
```tsx
// src/app/(app)/layout.tsx or your header component
import { NotificationBell } from "@/components/notifications/NotificationBell";

<header>
  ...
  <NotificationBell />
</header>
```

### 6. Wire trip status transitions
In your trip status update handler (API route / server action), import and call the helpers:

```ts
import {
  onTripAccepted,
  onRiderArriving,
  onRiderArrived,
  onTripStarted,
  onTripCompleted,
  onTripCancelled,
  onPaymentReceived,
  onPayoutProcessed,
} from "@/lib/trip-events";

// Example: PATCH /api/trips/:id/status
switch (newStatus) {
  case "ACCEPTED":
    await onTripAccepted(tripId, { clientId, riderId, riderName });
    break;
  case "ARRIVING":
    await onRiderArriving(tripId, { clientId, riderId, riderName, eta: 3 });
    break;
  // ... etc
}
```

### 7. FCM token registration (mobile/PWA)
On the client, after the user grants notification permission, register the FCM token:
```ts
const token = await getFCMToken(); // your Firebase client SDK call
await fetch("/api/notifications/preferences", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fcmToken: token }),
});
```

### 8. Pusher auth (private channels)
Add a Pusher auth endpoint to your app (required for `private-` channels):
```ts
// src/app/api/pusher/auth/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const data = await req.text();
  const params = new URLSearchParams(data);
  const socketId = params.get("socket_id")!;
  const channelName = params.get("channel_name")!;

  // Authorise only channels the user owns
  const userId = session.user.id;
  const allowed =
    channelName === `private-notify-${userId}` ||
    channelName.startsWith("private-chat-"); // trip participation checked at message level

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const authResponse = getPusherServer().authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
```
Then configure the Pusher client to use it:
```ts
// In src/lib/pusher/index.ts, update getPusherClient():
_pusherClient = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  channelAuthorization: {
    endpoint: "/api/pusher/auth",
    transport: "ajax",
  },
});
```

---

## Architecture overview

```
Trip status change
       │
       ▼
 trip-events.ts
  ├─ dispatchNotification()
  │    ├─ FCM push  (firebase-admin)
  │    ├─ SMS       (africa's talking)
  │    └─ Pusher    (private-notify-{userId})  ──► NotificationBell live update
  │
  └─ injectSystemMessage()
       └─ Pusher    (private-chat-{tripId})    ──► ChatRoom live update

User sends chat message
       │
  POST /api/chat/{tripId}/messages
       │
       ├─ Save to DB
       ├─ Pusher broadcast (private-chat-{tripId})
       └─ dispatchNotification(CHAT_MESSAGE) → recipient's PUSH + IN_APP
```
