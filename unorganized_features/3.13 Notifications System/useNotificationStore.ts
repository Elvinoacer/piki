import { create } from "zustand";

export interface InboxNotification {
  id: string;
  event: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
  tripId?: string | null;
}

export interface ToastNotification {
  id: string;
  title: string;
  body: string;
  event: string;
  data?: Record<string, unknown>;
}

interface NotificationState {
  /** Cached inbox items (most recent page). Source of truth is the API;
   *  this is for instant render + optimistic updates. */
  items: InboxNotification[];
  unreadCount: number;
  nextCursor: string | null;
  isLoading: boolean;

  /** Transient toast queue — realtime pushes render here before/independent
   *  of the inbox list. */
  toastQueue: ToastNotification[];

  // Actions
  setInbox: (items: InboxNotification[], unreadCount: number, nextCursor: string | null) => void;
  appendInbox: (items: InboxNotification[], nextCursor: string | null) => void;
  setLoading: (loading: boolean) => void;

  /** Called when a realtime "notification" event arrives over Pusher/Ably. */
  receiveRealtime: (payload: ToastNotification) => void;
  dismissToast: (id: string) => void;

  markRead: (ids: string[]) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  items: [],
  unreadCount: 0,
  nextCursor: null,
  isLoading: false,
  toastQueue: [],

  setInbox: (items, unreadCount, nextCursor) =>
    set({ items, unreadCount, nextCursor }),

  appendInbox: (items, nextCursor) =>
    set((state) => ({ items: [...state.items, ...items], nextCursor })),

  setLoading: (loading) => set({ isLoading: loading }),

  receiveRealtime: (payload) => {
    set((state) => ({
      toastQueue: [...state.toastQueue, payload],
      unreadCount: state.unreadCount + 1,
      // Prepend to inbox cache so the bell-icon dropdown is instantly fresh
      // without a refetch.
      items: [
        {
          id: payload.id,
          event: payload.event,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? null,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...state.items,
      ],
    }));
  },

  dismissToast: (id) =>
    set((state) => ({ toastQueue: state.toastQueue.filter((t) => t.id !== id) })),

  markRead: (ids) => {
    const idSet = new Set(ids);
    set((state) => {
      const items = state.items.map((item) =>
        idSet.has(item.id) && !item.read ? { ...item, read: true } : item,
      );
      const newlyRead = state.items.filter((i) => idSet.has(i.id) && !i.read).length;
      return {
        items,
        unreadCount: Math.max(0, state.unreadCount - newlyRead),
      };
    });

    // Fire-and-forget API call — UI already updated optimistically.
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch((err) => console.error("markRead failed:", err));
  },

  markAllRead: () => {
    set((state) => ({
      items: state.items.map((item) => ({ ...item, read: true })),
      unreadCount: 0,
    }));

    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch((err) => console.error("markAllRead failed:", err));
  },
}));

/** Convenience selector for components that only need the unread badge count. */
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
