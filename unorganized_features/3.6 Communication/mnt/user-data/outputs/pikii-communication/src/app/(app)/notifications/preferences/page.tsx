// src/app/(app)/notifications/preferences/page.tsx
// Settings page: toggle push/SMS/in-app globally and per notification type
"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Bell, MessageSquare, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationPreferences, NotificationType } from "@/types/communication";

const NOTIFICATION_TYPE_LABELS: Partial<Record<NotificationType, string>> = {
  TRIP_REQUESTED: "New ride requests",
  TRIP_ACCEPTED: "Trip accepted",
  RIDER_ARRIVING: "Rider arriving",
  RIDER_ARRIVED: "Rider arrived",
  TRIP_STARTED: "Trip started",
  TRIP_COMPLETED: "Trip completed",
  TRIP_CANCELLED: "Trip cancelled",
  PAYMENT_RECEIVED: "Payment received",
  PAYOUT_PROCESSED: "Payout processed",
  PROMO_AVAILABLE: "Promos & offers",
  DOCUMENT_EXPIRING: "Document expiry alerts",
  CHAT_MESSAGE: "Chat messages",
};

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        checked ? "bg-primary" : "bg-muted",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then(setPrefs);
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setChannel = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((p) => p ? { ...p, [key]: value } : p);
  };

  const setTypeOverride = (
    type: NotificationType,
    channel: "push" | "sms" | "inApp",
    value: boolean
  ) => {
    setPrefs((p) => {
      if (!p) return p;
      return {
        ...p,
        typeOverrides: {
          ...p.typeOverrides,
          [type]: {
            ...(p.typeOverrides[type] ?? {}),
            [channel.toUpperCase()]: value,
          },
        },
      };
    });
  };

  if (!prefs) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-6 pb-4 border-b">
        <h1 className="text-lg font-semibold">Notification preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Control how and when Pikii contacts you
        </p>
      </div>

      {/* Global channel toggles */}
      <section className="px-4 py-4 space-y-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Channels
        </p>

        {[
          { key: "pushEnabled" as const, label: "Push notifications", icon: Smartphone },
          { key: "smsEnabled" as const, label: "SMS (Africa's Talking)", icon: MessageSquare },
          { key: "inAppEnabled" as const, label: "In-app notifications", icon: Bell },
        ].map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{label}</span>
            </div>
            <Toggle
              checked={prefs[key] as boolean}
              onChange={(v) => setChannel(key, v)}
            />
          </div>
        ))}
      </section>

      <div className="border-t" />

      {/* Per-type overrides */}
      <section className="px-4 py-4 space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Per-event settings
        </p>

        {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => {
          const overrides = prefs.typeOverrides[type as NotificationType] ?? {};
          return (
            <div key={type} className="py-3 border-b last:border-0">
              <p className="text-sm font-medium mb-2">{label}</p>
              <div className="flex items-center gap-6">
                {(["PUSH", "SMS", "IN_APP"] as const).map((ch) => (
                  <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrides[ch] !== false}
                      onChange={(e) =>
                        setTypeOverride(
                          type as NotificationType,
                          ch.toLowerCase().replace("_", "") as "push" | "sms" | "inApp",
                          e.target.checked
                        )
                      }
                      className="rounded border-muted accent-primary w-3.5 h-3.5"
                    />
                    <span className="text-xs text-muted-foreground">
                      {ch === "IN_APP" ? "In-app" : ch === "PUSH" ? "Push" : "SMS"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Save button (sticky footer) */}
      <div className="fixed bottom-0 inset-x-0 bg-background border-t px-4 py-3 max-w-lg mx-auto">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            "Saved ✓"
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
