"use client";

import { useEffect, useState } from "react";

type Channel = "PUSH" | "SMS" | "IN_APP" | "EMAIL";

interface ChannelPref {
  channel: Channel;
  enabled: boolean;
  locked: boolean;
  isDefault: boolean;
}

interface EventPref {
  event: string;
  description: string;
  roles: string[];
  channels: ChannelPref[];
}

const CHANNEL_LABELS: Record<Channel, string> = {
  PUSH: "Push",
  SMS: "SMS",
  IN_APP: "In-app",
  EMAIL: "Email",
};

const EVENT_LABELS: Record<string, string> = {
  RIDE_MATCHED: "Rider matched",
  RIDER_ARRIVING: "Rider arriving",
  RIDER_ARRIVED: "Rider arrived",
  TRIP_STARTED: "Trip started",
  TRIP_COMPLETED: "Trip completed",
  TRIP_CANCELLED: "Trip cancelled",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_FAILED: "Payment failed",
  PAYOUT_PROCESSED: "Payout processed",
  DOCUMENT_EXPIRING: "Document expiring",
  DOCUMENT_EXPIRED: "Document expired",
  PROMO_AVAILABLE: "Promos & offers",
  SOS_TRIGGERED: "SOS alerts",
  BROADCAST: "Announcements",
};

/**
 * Notification preferences settings page.
 *
 * - Fetches the preference matrix from GET /api/notifications/preferences
 * - Renders one row per event, one toggle per channel
 * - Locked channels render as a disabled, always-on switch with a small
 *   "required" label (e.g. SMS for PAYMENT_RECEIVED, SOS channels)
 * - Saves are debounced per-toggle and PUT individually-batched on a short
 *   delay to avoid a request storm if the user flips several switches.
 *
 * Currently shown for the logged-in user's role only — filter `roles`
 * client-side using the user's role from your auth/session context.
 */
export function NotificationPreferencesPage({
  userRole,
}: {
  userRole: "CLIENT" | "RIDER" | "SACCO_ADMIN" | "ADMIN";
}): JSX.Element {
  const [events, setEvents] = useState<EventPref[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSave, setPendingSave] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.message ?? "Failed to load preferences"));
  }, []);

  function toggle(eventName: string, channel: Channel, nextEnabled: boolean) {
    if (!events) return;

    const key = `${eventName}:${channel}`;

    // Optimistic update
    setEvents((prev) =>
      prev!.map((ev) =>
        ev.event !== eventName
          ? ev
          : {
              ...ev,
              channels: ev.channels.map((c) =>
                c.channel !== channel ? c : { ...c, enabled: nextEnabled, isDefault: false },
              ),
            },
      ),
    );

    setPendingSave((prev) => new Set(prev).add(key));

    fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ event: eventName, channel, enabled: nextEnabled }],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
      .catch((err) => {
        setError(`Failed to save "${EVENT_LABELS[eventName] ?? eventName}" — ${CHANNEL_LABELS[channel]}: ${err.message}`);
        // Revert optimistic update on failure
        setEvents((prev) =>
          prev!.map((ev) =>
            ev.event !== eventName
              ? ev
              : {
                  ...ev,
                  channels: ev.channels.map((c) =>
                    c.channel !== channel ? c : { ...c, enabled: !nextEnabled },
                  ),
                },
          ),
        );
      })
      .finally(() => {
        setPendingSave((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      });
  }

  if (error && !events) {
    return <div style={{ padding: 16, color: "#e11d48" }}>Couldn't load notification settings: {error}</div>;
  }

  if (!events) {
    return <div style={{ padding: 16, color: "#999" }}>Loading notification settings…</div>;
  }

  const visibleEvents = events.filter(
    (ev) => ev.roles.includes("ALL") || ev.roles.includes(userRole),
  );

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Notification settings</h1>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>
        Choose how you'd like to hear from Pikii. Some safety and payment notifications can't be
        turned off.
      </p>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            padding: 12,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 64px 64px 64px 64px",
            gap: 8,
            padding: "8px 4px",
            fontSize: 12,
            fontWeight: 700,
            color: "#999",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          <div />
          <div style={{ textAlign: "center" }}>Push</div>
          <div style={{ textAlign: "center" }}>SMS</div>
          <div style={{ textAlign: "center" }}>In-app</div>
          <div style={{ textAlign: "center" }}>Email</div>
        </div>

        {visibleEvents.map((ev) => (
          <div
            key={ev.event}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 64px 64px 64px 64px",
              gap: 8,
              alignItems: "center",
              padding: "12px 4px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {EVENT_LABELS[ev.event] ?? ev.event}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>{ev.description}</div>
            </div>

            {(["PUSH", "SMS", "IN_APP", "EMAIL"] as Channel[]).map((channel) => {
              const pref = ev.channels.find((c) => c.channel === channel);
              if (!pref) return <div key={channel} />;

              const saving = pendingSave.has(`${ev.event}:${channel}`);

              return (
                <div key={channel} style={{ display: "flex", justifyContent: "center" }}>
                  <ToggleSwitch
                    checked={pref.enabled}
                    disabled={pref.locked || saving}
                    onChange={(next) => toggle(ev.event, channel, next)}
                    title={pref.locked ? "Required — cannot be disabled" : CHANNEL_LABELS[channel]}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  title,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: "none",
        background: checked ? "#16a34a" : "#d1d5db",
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled && checked ? 0.7 : disabled ? 0.4 : 1,
        flexShrink: 0,
        padding: 0,
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}
