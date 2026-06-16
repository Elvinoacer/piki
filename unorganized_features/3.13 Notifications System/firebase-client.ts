"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";

/**
 * Client-side Firebase app singleton.
 *
 * Used by useNotifications.ts to call getMessaging() + getToken() for web
 * push token registration. Server-side FCM (sending messages) uses the
 * firebase-admin SDK in providers/fcm.ts — these are two separate SDKs.
 *
 * Required NEXT_PUBLIC_ env vars (safe to expose — not secret):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *
 * Also needed for web push:
 *   NEXT_PUBLIC_FCM_VAPID_KEY  (from Firebase Console → Project Settings →
 *                               Cloud Messaging → Web Push certificates)
 */
export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();

  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  });
}
