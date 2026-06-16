// src/store/useCommunicationStore.ts
// Zustand slice combining chat + notification state.
// Split into two named slices so they can be consumed independently.

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ChatMessage, NotificationRecord } from "@/types/communication";

// ── Chat slice ────────────────────────────────────────────────────────────────

interface ChatState {
  messages: ChatMessage[];
  isActive: boolean; // whether the chat room is open
  isLoading: boolean;
  cursor: string | null; // for pagination
  hasMore: boolean;

  // Actions
  setMessages: (msgs: ChatMessage[]) => void;
  prependMessages: (msgs: ChatMessage[]) => void; // load-older prepend
  addMessage: (msg: ChatMessage) => void;
  markRead: (ids: string[]) => void;
  setChatActive: (active: boolean) => void;
  setChatLoading: (loading: boolean) => void;
  setCursor: (cursor: string | null) => void;
  setHasMore: (has: boolean) => void;
  reset: () => void;
}

const chatInitial: Omit<
  ChatState,
  "setMessages" | "prependMessages" | "addMessage" | "markRead" | "setChatActive" | "setChatLoading" | "setCursor" | "setHasMore" | "reset"
> = {
  messages: [],
  isActive: false,
  isLoading: false,
  cursor: null,
  hasMore: false,
};

export const useChatStore = create<ChatState>()(
  immer((set) => ({
    ...chatInitial,

    setMessages: (msgs) =>
      set((state) => {
        state.messages = msgs;
      }),

    prependMessages: (msgs) =>
      set((state) => {
        // Avoid duplicates
        const existingIds = new Set(state.messages.map((m) => m.id));
        state.messages = [...msgs.filter((m) => !existingIds.has(m.id)), ...state.messages];
      }),

    addMessage: (msg) =>
      set((state) => {
        // Optimistic — replace temp message or append
        const idx = state.messages.findIndex((m) => m.id === msg.id);
        if (idx === -1) {
          state.messages.push(msg);
        } else {
          state.messages[idx] = msg;
        }
      }),

    markRead: (ids) =>
      set((state) => {
        const idSet = new Set(ids);
        state.messages = state.messages.map((m) =>
          idSet.has(m.id) ? { ...m, readAt: new Date().toISOString() } : m
        );
      }),

    setChatActive: (active) =>
      set((state) => {
        state.isActive = active;
      }),

    setChatLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setCursor: (cursor) =>
      set((state) => {
        state.cursor = cursor;
      }),

    setHasMore: (has) =>
      set((state) => {
        state.hasMore = has;
      }),

    reset: () =>
      set((state) => {
        Object.assign(state, chatInitial);
      }),
  }))
);

// ── Notification slice ────────────────────────────────────────────────────────

interface NotificationState {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  cursor: string | null;
  hasMore: boolean;

  // Actions
  setNotifications: (items: NotificationRecord[]) => void;
  appendNotifications: (items: NotificationRecord[]) => void;
  prependNotification: (item: NotificationRecord) => void; // real-time arrival
  markRead: (ids: string[] | "all") => void;
  setUnreadCount: (n: number) => void;
  setLoading: (loading: boolean) => void;
  setCursor: (cursor: string | null) => void;
  setHasMore: (has: boolean) => void;
}

export const useNotificationStore = create<NotificationState>()(
  immer((set) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    cursor: null,
    hasMore: false,

    setNotifications: (items) =>
      set((state) => {
        state.notifications = items;
      }),

    appendNotifications: (items) =>
      set((state) => {
        const ids = new Set(state.notifications.map((n) => n.id));
        state.notifications.push(...items.filter((n) => !ids.has(n.id)));
      }),

    prependNotification: (item) =>
      set((state) => {
        state.notifications.unshift(item);
        state.unreadCount = state.unreadCount + 1;
      }),

    markRead: (ids) =>
      set((state) => {
        if (ids === "all") {
          state.notifications = state.notifications.map((n) => ({
            ...n,
            readAt: n.readAt ?? new Date().toISOString(),
          }));
          state.unreadCount = 0;
        } else {
          const idSet = new Set(ids);
          let readCount = 0;
          state.notifications = state.notifications.map((n) => {
            if (idSet.has(n.id) && !n.readAt) {
              readCount++;
              return { ...n, readAt: new Date().toISOString() };
            }
            return n;
          });
          state.unreadCount = Math.max(0, state.unreadCount - readCount);
        }
      }),

    setUnreadCount: (n) =>
      set((state) => {
        state.unreadCount = n;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setCursor: (cursor) =>
      set((state) => {
        state.cursor = cursor;
      }),

    setHasMore: (has) =>
      set((state) => {
        state.hasMore = has;
      }),
  }))
);
