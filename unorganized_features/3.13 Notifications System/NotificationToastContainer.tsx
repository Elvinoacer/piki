"use client";

import { useEffect } from "react";
import { useNotificationStore } from "@/lib/stores/useNotificationStore";

const AUTO_DISMISS_MS = 6000;

/**
 * Renders realtime "toast" notifications (e.g. "Rider matched!", "Your
 * rider has arrived") as they arrive over the realtime channel. Auto-
 * dismisses after AUTO_DISMISS_MS. Mount once near the app root, alongside
 * useNotifications().
 *
 * Tapping a toast can deep-link via `data` (e.g. data.tripId →
 * navigate to active trip screen) — wire that up via onToastClick.
 */
export function NotificationToastContainer({
  onToastClick,
}: {
  onToastClick?: (data?: Record<string, unknown>) => void;
}): JSX.Element | null {
  const toastQueue = useNotificationStore((s) => s.toastQueue);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  useEffect(() => {
    if (toastQueue.length === 0) return;
    const timers = toastQueue.map((toast) =>
      setTimeout(() => dismissToast(toast.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toastQueue, dismissToast]);

  if (toastQueue.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        left: 16,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 380,
        marginLeft: "auto",
      }}
      aria-live="polite"
    >
      {toastQueue.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          onClick={() => {
            onToastClick?.(toast.data);
            dismissToast(toast.id);
          }}
          style={{
            background: "white",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            cursor: "pointer",
            borderLeft: toast.event === "SOS_TRIGGERED" ? "4px solid #e11d48" : "4px solid #2563eb",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{toast.title}</div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 2 }}>{toast.body}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(toast.id);
            }}
            aria-label="Dismiss"
            style={{
              border: "none",
              background: "none",
              fontSize: 18,
              color: "#999",
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
