// src/lib/pusher/hooks.ts
// React hooks for subscribing to Pusher channels.
// Components mount these once; Pusher handles reconnection automatically.

"use client";

import { useEffect } from "react";
import { getPusherClient, chatChannel, notifyChannel, PUSHER_EVENTS } from "@/lib/pusher";
import { useChatStore, useNotificationStore } from "@/store/useCommunicationStore";
import type {
  ChatMessage,
  PusherChatEvent,
  PusherNotificationEvent,
} from "@/types/communication";

// ── Chat channel hook ─────────────────────────────────────────────────────────

/**
 * Subscribe to real-time chat events for a trip.
 * Mount inside the ChatRoom page component.
 */
export function useChatChannel(tripId: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const markRead = useChatStore((s) => s.markRead);
  const setChatActive = useChatStore((s) => s.setChatActive);

  useEffect(() => {
    if (!tripId) return;

    const client = getPusherClient();
    const channel = client.subscribe(chatChannel(tripId));

    channel.bind(PUSHER_EVENTS.NEW_MESSAGE, (data: PusherChatEvent) => {
      addMessage(data.message);
    });

    channel.bind(
      PUSHER_EVENTS.MESSAGE_READ,
      (data: { readIds: string[]; readBy: string }) => {
        markRead(data.readIds);
      }
    );

    channel.bind(PUSHER_EVENTS.CHAT_CLOSED, () => {
      setChatActive(false);
    });

    return () => {
      channel.unbind_all();
      client.unsubscribe(chatChannel(tripId));
    };
  }, [tripId, addMessage, markRead, setChatActive]);
}

// ── Notification channel hook ─────────────────────────────────────────────────

/**
 * Subscribe to real-time in-app notifications for the current user.
 * Mount in the root layout or a persistent header component.
 */
export function useNotificationChannel(userId: string | null) {
  const prependNotification = useNotificationStore((s) => s.prependNotification);

  useEffect(() => {
    if (!userId) return;

    const client = getPusherClient();
    const channel = client.subscribe(notifyChannel(userId));

    channel.bind(
      PUSHER_EVENTS.NEW_NOTIFICATION,
      (data: PusherNotificationEvent) => {
        prependNotification(data.notification);
      }
    );

    return () => {
      channel.unbind_all();
      client.unsubscribe(notifyChannel(userId));
    };
  }, [userId, prependNotification]);
}
