"use client";
// components/safety/SosButton.tsx
// Large, one-tap SOS button shown during an active trip.

import { useState } from "react";
import { useSafetyStore } from "@/store/safetyStore";

interface SosButtonProps {
  tripId?: string;
}

export function SosButton({ tripId }: SosButtonProps) {
  const { sosActive, triggerSos, clearSos } = useSafetyStore();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    if (sosActive) return;
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel confirmation after 4 seconds.
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setConfirming(false);
    setLoading(true);
    try {
      await triggerSos(tripId);
    } finally {
      setLoading(false);
    }
  }

  if (sosActive) {
    return (
      <div className="sos-active" role="alert">
        <span className="sos-pulse" aria-hidden="true" />
        <div className="sos-active-text">
          <strong>Emergency sent</strong>
          <p>Your location has been shared with your contacts and our safety team.</p>
        </div>
        <button className="sos-dismiss" onClick={clearSos} aria-label="Dismiss SOS alert">
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <button
      className={`sos-btn ${confirming ? "sos-btn--confirming" : ""}`}
      onClick={handlePress}
      disabled={loading}
      aria-label="Emergency SOS — tap twice to send"
    >
      {loading ? (
        <span className="sos-spinner" aria-hidden="true" />
      ) : confirming ? (
        <>
          <span className="sos-icon" aria-hidden="true">⚠️</span>
          <span>Tap again to send SOS</span>
        </>
      ) : (
        <>
          <span className="sos-icon" aria-hidden="true">🆘</span>
          <span>SOS</span>
        </>
      )}
    </button>
  );
}
