"use client";

import { useState, useRef, useEffect } from "react";
import { useNotificationStore } from "@/lib/stores/useNotificationStore";

const EVENT_ICONS: Record<string, string> = {
  RIDE_MATCHED: "🏍️",
  RIDER_ARRIVING: "📍",
  RIDER_ARRIVED: "✅",
  TRIP_STARTED: "🚀",
  TRIP_COMPLETED: "🏁",
  TRIP_CANCELLED: "❌",
  PAYMENT_RECEIVED: "💰",
  PAYMENT_FAILED: "⚠️",
  PAYOUT_PROCESSED: "💸",
  DOCUMENT_EXPIRING: "📄",
  DOCUMENT_EXPIRED: "🚫",
  PROMO_AVAILABLE: "🎁",
  SOS_TRIGGERED: "🚨",
  BROADCAST: "📢",
};

/**
 * Bell icon + unread badge + dropdown inbox. Designed for large tap targets
 * (PRD §5 accessibility — mid-range Android, one-handed use).
 *
 * Place in the app header/nav. Requires useNotifications(userId) to have
 * been called somewhere in the tree (provides the store data this reads).
 */
export function NotificationBell(): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleItemClick(id: string, read: boolean) {
    if (!read) markRead([id]);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        style={{
          position: "relative",
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 24,
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              background: "#e11d48",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: 56,
            width: 360,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: 480,
            overflowY: "auto",
            background: "white",
            borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              borderBottom: "1px solid #eee",
            }}
          >
            <strong style={{ fontSize: 15 }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 13,
                  color: "#2563eb",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 8,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {isLoading && items.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>Loading…</div>
          )}

          {!isLoading && items.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
              No notifications yet.
            </div>
          )}

          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id, item.read)}
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                textAlign: "left",
                padding: "12px 16px",
                border: "none",
                background: item.read ? "white" : "#f0f6ff",
                borderBottom: "1px solid #f3f3f3",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 22, lineHeight: "24px" }}>
                {EVENT_ICONS[item.event] ?? "🔔"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: item.read ? 500 : 700, fontSize: 14 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: "#666", marginTop: 2 }}>{item.body}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                  {formatRelativeTime(item.createdAt)}
                </div>
              </div>
              {!item.read && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: "#2563eb",
                    flexShrink: 0,
                    marginTop: 6,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
