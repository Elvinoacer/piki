// public/firebase-messaging-sw.js
//
// Firebase Cloud Messaging service worker — handles background push
// notifications when the Pikii web app is not in the foreground.
//
// This file MUST live at /public/firebase-messaging-sw.js so it is served
// from the root origin (/firebase-messaging-sw.js). Next.js serves /public
// files verbatim at the root path.
//
// HOW IT WORKS:
//   1. useNotifications.ts registers the FCM web SDK via getToken().
//      The SDK auto-discovers this service worker by the conventional path.
//   2. When a push arrives and the app tab is NOT focused, Firebase routes
//      the message here instead of to the app window.
//   3. We call showNotification() with the FCM payload (title/body sent by
//      fcm.ts via the `notification` field) plus a click handler that opens
//      the correct deep-link screen.
//
// IMPORTANT: keep this file plain JS (no TypeScript, no bundling) — service
// workers run in a separate context and are served as static assets. If you
// use a bundler (Webpack/Turbopack), add this file to the copy-plugin so it
// is not transformed. With Next.js App Router + the /public folder there is
// nothing extra to configure — the file is already served statically.

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// ---------------------------------------------------------------------------
// Firebase config — must match your web app's firebaseConfig.
// These are public-safe values (not secret keys). The VAPID key is separate
// and stays server-side / in NEXT_PUBLIC_FCM_VAPID_KEY.
// ---------------------------------------------------------------------------
firebase.initializeApp({
  apiKey: self.__FIREBASE_API_KEY__ || "",
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || "",
  projectId: self.__FIREBASE_PROJECT_ID__ || "",
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || "",
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || "",
  appId: self.__FIREBASE_APP_ID__ || "",
});

// ---------------------------------------------------------------------------
// NOTE on injecting config values:
// The `self.__FIREBASE_*__` globals above need to be set before this script
// runs. The cleanest way is to generate a tiny inline script in _document.tsx
// (or a Next.js script tag with strategy="beforeInteractive") that sets
// window.__FIREBASE_PROJECT_ID__ etc from your NEXT_PUBLIC_ env vars.
// Alternatively, hard-code the values directly here since they are not secret.
// ---------------------------------------------------------------------------

const messaging = firebase.messaging();

// Background message handler — fires when the app tab is closed/hidden.
messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload;

  const title = notification?.title || "Pikii";
  const body = notification?.body || "";

  const notificationOptions = {
    body,
    icon: "/icons/icon-192x192.png",   // put your app icon here
    badge: "/icons/badge-72x72.png",
    tag: data?.notificationId || "pikii-notification", // collapses duplicate pushes
    data: {
      url: buildDeepLinkUrl(data),
      notificationId: data?.notificationId,
    },
    // Vibration pattern for Android (ms on, ms off, ms on)
    vibrate: [200, 100, 200],
    requireInteraction: data?.event === "SOS_TRIGGERED", // SOS stays until dismissed
  };

  self.registration.showNotification(title, notificationOptions);
});

// Click handler — opens the app at the correct screen when the user taps
// the notification in the OS notification tray.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open in a tab, focus it and navigate.
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        // Otherwise open a new tab.
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});

/**
 * Builds the deep-link URL from the FCM data payload fields set by
 * dispatcher.ts → sendChannel (the `data` field of PushPayload).
 *
 * FCM data fields are all strings. Mapping:
 *   event=RIDE_MATCHED + tripId → /trips/{tripId}
 *   event=PAYMENT_RECEIVED + tripId → /trips/{tripId}#payment
 *   event=PAYOUT_PROCESSED → /wallet/payouts
 *   event=DOCUMENT_EXPIRING / DOCUMENT_EXPIRED → /profile/documents
 *   event=PROMO_AVAILABLE → /promos
 *   event=SOS_TRIGGERED + tripId → /trips/{tripId}#sos
 *   event=BROADCAST → /home
 *   fallback → /notifications
 */
function buildDeepLinkUrl(data) {
  if (!data) return "/notifications";

  const { event, tripId, deepLink } = data;

  // Honour an explicit deepLink from the dispatcher if present.
  if (deepLink) return deepLink;

  switch (event) {
    case "RIDE_MATCHED":
    case "RIDER_ARRIVING":
    case "RIDER_ARRIVED":
    case "TRIP_STARTED":
    case "TRIP_COMPLETED":
    case "TRIP_CANCELLED":
    case "PAYMENT_RECEIVED":
    case "PAYMENT_FAILED":
      return tripId ? `/trips/${tripId}` : "/history";
    case "SOS_TRIGGERED":
      return tripId ? `/trips/${tripId}#sos` : "/home";
    case "PAYOUT_PROCESSED":
      return "/wallet/payouts";
    case "DOCUMENT_EXPIRING":
    case "DOCUMENT_EXPIRED":
      return "/profile/documents";
    case "PROMO_AVAILABLE":
      return "/promos";
    case "BROADCAST":
      return "/home";
    default:
      return "/notifications";
  }
}
