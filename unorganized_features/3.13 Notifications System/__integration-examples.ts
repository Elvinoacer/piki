import { triggerNotification, triggerBulkNotification } from "@/lib/notifications/dispatcher";

/**
 * INTEGRATION EXAMPLES — not a runnable module.
 *
 * These snippets show exactly where to call triggerNotification() from your
 * existing trip/payment/payout/document logic. Copy the relevant call into
 * the corresponding server action / route handler / worker — do not import
 * this file directly.
 *
 * Each example lists the `vars` required by its template (see templates.ts)
 * — passing fewer vars leaves `{{placeholder}}` literally in the rendered
 * text, so treat this as the contract for that call site.
 */

// ----------------------------------------------------------------------------
// 1. RIDE_MATCHED — call when a rider accepts a trip request
//    (PRD §4.3 step 4: "First rider to accept is assigned")
// ----------------------------------------------------------------------------
async function onRiderAcceptedTrip(trip: {
  id: string;
  clientId: string;
  riderName: string;
  vehiclePlate: string;
  etaMinutes: number;
}) {
  await triggerNotification({
    userId: trip.clientId,
    event: "RIDE_MATCHED",
    tripId: trip.id,
    vars: {
      riderName: trip.riderName,
      vehiclePlate: trip.vehiclePlate,
      etaMinutes: trip.etaMinutes,
    },
    data: { tripId: trip.id, deepLink: `/trips/${trip.id}` },
  });
}

// ----------------------------------------------------------------------------
// 2. RIDER_ARRIVING / RIDER_ARRIVED — call from your location-update handler
//    when the rider's live position crosses the "arriving" / "arrived"
//    geofence threshold around the pickup point.
// ----------------------------------------------------------------------------
async function onRiderProximityChange(trip: {
  id: string;
  clientId: string;
  riderName: string;
  etaMinutes: number;
}, status: "ARRIVING" | "ARRIVED") {
  if (status === "ARRIVING") {
    await triggerNotification({
      userId: trip.clientId,
      event: "RIDER_ARRIVING",
      tripId: trip.id,
      vars: { riderName: trip.riderName, etaMinutes: trip.etaMinutes },
    });
  } else {
    await triggerNotification({
      userId: trip.clientId,
      event: "RIDER_ARRIVED",
      tripId: trip.id,
      vars: { riderName: trip.riderName },
    });
  }
}

// ----------------------------------------------------------------------------
// 3. TRIP_COMPLETED — call after status transitions to "completed" and the
//    receipt PDF has been generated (PRD §3.5, §3.14).
//    Fire to BOTH client and rider with different `vars` framing if desired —
//    here shown for the client.
// ----------------------------------------------------------------------------
async function onTripCompleted(trip: {
  id: string;
  clientId: string;
  destinationAddress: string;
  fareAmount: number;
  currency: string;
  receiptUrl: string;
}) {
  await triggerNotification({
    userId: trip.clientId,
    event: "TRIP_COMPLETED",
    tripId: trip.id,
    vars: {
      destination: trip.destinationAddress,
      amount: trip.fareAmount.toFixed(2),
      currency: trip.currency,
      receiptUrl: trip.receiptUrl,
    },
    data: { tripId: trip.id, receiptUrl: trip.receiptUrl },
  });
}

// ----------------------------------------------------------------------------
// 4. TRIP_CANCELLED — call from your cancellation handler. `feeNote` is
//    pre-formatted text (empty string if no fee applies) so the template
//    stays locale-agnostic about currency formatting.
// ----------------------------------------------------------------------------
async function onTripCancelled(trip: {
  id: string;
  notifyUserId: string; // the OTHER party to the cancellation
  cancelledByRole: "rider" | "client";
  cancellationFee?: { amount: number; currency: string };
}) {
  const feeNote = trip.cancellationFee
    ? `A cancellation fee of ${trip.cancellationFee.currency} ${trip.cancellationFee.amount.toFixed(2)} applies.`
    : "";

  await triggerNotification({
    userId: trip.notifyUserId,
    event: "TRIP_CANCELLED",
    tripId: trip.id,
    vars: {
      cancelledBy: trip.cancelledByRole === "rider" ? "Your rider" : "The client",
      feeNote,
    },
  });
}

// ----------------------------------------------------------------------------
// 5. PAYMENT_RECEIVED — call from your M-Pesa Daraja STK Push callback
//    handler, AFTER verifying the callback signature/idempotency
//    (PRD §5 "Payment operations must be idempotent").
// ----------------------------------------------------------------------------
async function onMpesaPaymentConfirmed(payment: {
  userId: string;
  tripId: string;
  amount: number;
  currency: string;
  mpesaReceiptNumber: string;
}) {
  await triggerNotification({
    userId: payment.userId,
    event: "PAYMENT_RECEIVED",
    tripId: payment.tripId,
    vars: {
      amount: payment.amount.toFixed(2),
      currency: payment.currency,
      method: "M-Pesa",
      reference: payment.mpesaReceiptNumber,
    },
  });
}

// ----------------------------------------------------------------------------
// 6. PAYOUT_PROCESSED — call after a successful M-Pesa B2C payout
//    (PRD §3.5 "Rider payout/withdrawal to M-Pesa (B2C)").
// ----------------------------------------------------------------------------
async function onPayoutProcessed(payout: {
  riderId: string;
  amount: number;
  currency: string;
  mpesaPhone: string; // full number — we only expose last 4 digits
  reference: string;
}) {
  await triggerNotification({
    userId: payout.riderId,
    event: "PAYOUT_PROCESSED",
    vars: {
      amount: payout.amount.toFixed(2),
      currency: payout.currency,
      phoneLast4: payout.mpesaPhone.slice(-4),
      reference: payout.reference,
    },
  });
}

// ----------------------------------------------------------------------------
// 7. PROMO_AVAILABLE — call from your promo campaign creation flow
//    (PRD §3.15 referrals/promos).
// ----------------------------------------------------------------------------
async function onPromoCampaignTargetUser(promo: {
  userId: string;
  title: string;
  body: string;
  code: string;
}) {
  await triggerNotification({
    userId: promo.userId,
    event: "PROMO_AVAILABLE",
    vars: { promoTitle: promo.title, promoBody: promo.body, promoCode: promo.code },
    data: { promoCode: promo.code },
  });
}

// ----------------------------------------------------------------------------
// 8. SOS_TRIGGERED — call from the SOS endpoint. Notify BOTH the platform
//    safety team (via a fixed admin/safety user id or queue) AND the rider's
//    trusted contacts. Channels SMS+PUSH are locked-on for this event
//    regardless of preferences (events.ts).
// ----------------------------------------------------------------------------
async function onSosTriggered(sos: {
  tripId: string;
  triggeredByUserId: string;
  triggeredByName: string;
  safetyTeamUserIds: string[];
  trustedContactUserIds: string[];
  locationUrl: string;
}) {
  const vars = {
    triggeredByName: sos.triggeredByName,
    tripId: sos.tripId,
    locationUrl: sos.locationUrl,
  };

  await triggerBulkNotification({
    userIds: [...sos.safetyTeamUserIds, ...sos.trustedContactUserIds],
    event: "SOS_TRIGGERED",
    vars,
    data: { tripId: sos.tripId, locationUrl: sos.locationUrl },
  });
}

// ----------------------------------------------------------------------------
// 9. BROADCAST — admin-issued zone-wide announcement
//    (PRD §3.12 "Broadcast notifications (e.g. 'Roadblock on Thika Rd...')").
//    See src/app/api/notifications/broadcast/route.ts for the HTTP entrypoint
//    that resolves `targetUserIds` from a Zone and calls this.
// ----------------------------------------------------------------------------
async function onAdminBroadcast(broadcast: {
  targetUserIds: string[];
  title: string;
  body: string;
}) {
  await triggerBulkNotification({
    userIds: broadcast.targetUserIds,
    event: "BROADCAST",
    vars: { broadcastTitle: broadcast.title, broadcastBody: broadcast.body },
  });
}
