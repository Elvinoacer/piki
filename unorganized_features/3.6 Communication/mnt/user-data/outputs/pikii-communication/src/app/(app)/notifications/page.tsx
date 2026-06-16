// src/app/(app)/notifications/page.tsx
// Full-page notification inbox with infinite scroll + mark-all-read
"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Bell } from "lucide-react";
import { useNotificationStore } from "@/store/useCommunicationStore";
import { useNotificationChannel } from "@/lib/pusher/hooks";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import type { NotificationRecord } from "@/types/communication";

export default function NotificationsPage() {
  const { data: session } = useSession();
  const bottomRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    cursor,
    hasMore,
    setNotifications,
    appendNotifications,
    setUnreadCount,
    setLoading,
    setCursor,
    setHasMore,
    markRead,
  } = useNotificationStore();

  // Real-time
  useNotificationChannel(session?.user?.id ?? null);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Infinite scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasMore || isLoading) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadPage(cursor);
      },
      { threshold: 0.1 }
    );

    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, cursor]);

  const loadPage = useCallback(async (cursorId: string | null) => {
    setLoading(true);
    try {
      const url = new URL("/api/notifications", window.location.origin);
      url.searchParams.set("limit", "20");
      if (cursorId) url.searchParams.set("cursor", cursorId);

      const res = await fetch(url.toString());
      const data = await res.json();
      const items = data.notifications as NotificationRecord[];

      if (cursorId) {
        appendNotifications(items);
      } else {
        setNotifications(items);
      }

      setUnreadCount(data.unreadCount ?? 0);
      setCursor(data.cursor ?? null);
      setHasMore(data.cursor !== null);
    } finally {
      setLoading(false);
    }
  }, [appendNotifications, setNotifications, setUnreadCount, setLoading, setCursor, setHasMore]);

  const handleMarkAllRead = async () => {
    markRead("all");
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
  };

  const handleRead = async (id: string) => {
    markRead([id]);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  };

  return (
    <div className="max-w-lg mx-auto pb-20">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3 sticky top-0 bg-background z-10 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="divide-y">
        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <Bell className="w-10 h-10 opacity-30" />
            <p className="text-sm">You're all caught up!</p>
          </div>
        )}

        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} onRead={handleRead} />
        ))}

        {/* Bottom sentinel for infinite scroll */}
        <div ref={bottomRef} className="h-4" />

        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!hasMore && notifications.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-4">
            You've reached the beginning
          </p>
        )}
      </div>
    </div>
  );
}
