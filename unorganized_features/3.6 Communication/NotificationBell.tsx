// src/components/notifications/NotificationBell.tsx
// Mounts in the app header. Shows a badge with unread count.
// Clicking opens a dropdown with the most recent 10 notifications.
"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useNotificationStore } from "@/store/useCommunicationStore";
import { useNotificationChannel } from "@/lib/pusher/hooks";
import { NotificationItem } from "./NotificationItem";
import type { NotificationRecord } from "@/types/communication";

export function NotificationBell() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    setNotifications,
    setUnreadCount,
    setLoading,
    markRead,
    prependNotification,
  } = useNotificationStore();

  // Real-time subscription
  useNotificationChannel(session?.user?.id ?? null);

  // ── Fetch on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.id) return;
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=10");
      const data = await res.json();
      setNotifications(data.notifications as NotificationRecord[]);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  };

  // ── Close on outside click ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-11 z-50 w-80 rounded-xl border bg-background shadow-lg",
            "overflow-hidden flex flex-col",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-96 divide-y">
            {isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No notifications yet
              </div>
            )}

            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onRead={handleRead}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2 bg-muted/30">
            <a
              href="/notifications"
              className="text-xs text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
