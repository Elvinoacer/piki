# Notifications System (PRD §3.13)

End-to-end implementation: Push (FCM), SMS (Africa's Talking), in-app (realtime), and email,
driven by a central event registry with per-user, per-channel, per-event preferences and
EN/SW templates.

## File map

```
prisma/notifications.prisma                          Schema additions (merge into schema.prisma)

src/lib/notifications/
  events.ts                                           Event registry: default channels, locked channels, template keys
  templates.ts                                        EN/SW templates per channel, with {{var}} interpolation + fallback
  preferences.ts                                      Resolves enabled/skipped channels per user (applies overrides + locks)
  dispatcher.ts                                       triggerNotification() / triggerBulkNotification() / sendChannel()
  realtime.ts                                         In-app emit via Pusher/Ably
  providers/
    types.ts                                          Shared SendResult/Payload interfaces
    fcm.ts                                            FCM push provider (firebase-admin)
    africastalking.ts                                 Africa's Talking SMS provider (REST, no SDK)
    email.ts                                          Resend email provider
  __integration-examples.ts                           Copy-paste call sites for existing trip/payment/payout flows
  __tests__/                                          Vitest unit tests (templates, preferences)

src/lib/queue/
  queues.ts                                           BullMQ queue + Redis connection + repeatable job scheduler
  workers/
    notifications.ts                                  Worker: dispatch-channels / dispatch-bulk jobs
    document-expiry.ts                                Daily worker: DOCUMENT_EXPIRING / DOCUMENT_EXPIRED + auto-offline

src/lib/stores/useNotificationStore.ts                Zustand slice: inbox, unread count, toast queue
src/hooks/useNotifications.ts                         Wires realtime sub + initial fetch + FCM token registration

src/app/api/notifications/
  route.ts                                            GET inbox (paginated) / PATCH mark-read
  preferences/route.ts                                GET/PUT preference matrix
  push-tokens/route.ts                                POST/DELETE FCM token registration
  broadcast/route.ts                                  Admin-only zone broadcast (PRD §3.12)

src/components/notifications/
  NotificationBell.tsx                                Bell icon + unread badge + dropdown inbox
  NotificationToastContainer.tsx                      Realtime toast popups
  NotificationPreferencesPage.tsx                      Settings page: event x channel toggle matrix
```

## Setup

1. **Merge schema**: copy models/enums from `prisma/notifications.prisma` into your main
   `schema.prisma`, add the three relation fields to `User` (and one to `Trip`) as commented
   at the bottom of that file, then:
   ```
   npx prisma migrate dev --name notifications
   ```

2. **Env vars** — see `.env.example` for the full list (FCM, Africa's Talking, Resend, Redis,
   Pusher/Ably).

3. **Run the workers** as a separate process from the Next.js server:
   ```
   # entrypoint that imports both workers
   import "@/lib/queue/workers/notifications";
   import "@/lib/queue/workers/document-expiry";
   ```
   and call `scheduleDocumentExpiryChecks()` once (e.g. in a deploy hook / admin script) to
   register the daily repeatable job.

4. **Mount client wiring** once near the app root:
   ```tsx
   const { user } = useSession();
   useNotifications(user?.id);
   ```
   then render `<NotificationBell />` in the header and `<NotificationToastContainer />`
   near the root.

## Triggering notifications

```ts
import { triggerNotification } from "@/lib/notifications/dispatcher";

await triggerNotification({
  userId: client.id,
  event: "RIDE_MATCHED",
  tripId: trip.id,
  vars: { riderName: "James", vehiclePlate: "KMEA 123B", etaMinutes: 4 },
  data: { tripId: trip.id, deepLink: `/trips/${trip.id}` },
});
```

See `__integration-examples.ts` for all 9 event call sites mapped to PRD trip/payment/payout/
document/promo/SOS/broadcast flows.

## Design notes

- **Locked channels**: some channels can't be opted out per event (e.g. SMS for
  `PAYMENT_RECEIVED`/`PAYOUT_PROCESSED`, PUSH+SMS for `SOS_TRIGGERED`, IN_APP for
  `DOCUMENT_EXPIRED`). Enforced in `events.ts` + validated server-side in the preferences PUT.
- **Idempotency**: `sendChannel()` skips channels already `SENT`/`DELIVERED`, so BullMQ retries
  after a partial failure don't double-send.
- **IN_APP is synchronous**, PUSH/SMS/EMAIL are queued — a slow SMS provider never blocks the
  request that triggered the notification.
- **i18n**: templates fall back `locale+channel -> locale+IN_APP -> en+channel -> en+IN_APP`.
  Add new locales by adding a key to `TemplateSet` in `templates.ts`.
