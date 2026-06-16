"use client";
// components/safety/NightCheckInBanner.tsx
// Displays a dismissable banner when a night check-in is received.
// Rendered at app level; listens to useSafetyStore.

import { useSafetyStore } from "@/store/safetyStore";

export function NightCheckInBanner() {
  const { pendingCheckIn, respondToCheckIn } = useSafetyStore();

  if (!pendingCheckIn) return null;

  return (
    <div
      className="night-checkin"
      role="alert"
      aria-live="assertive"
      aria-label="Safety check-in"
    >
      <span className="night-checkin__icon" aria-hidden="true">🌙</span>
      <div className="night-checkin__text">
        <strong>Safety check-in</strong>
        <p>It's late. Are you safe?</p>
      </div>
      <button
        className="night-checkin__confirm"
        onClick={() => respondToCheckIn(pendingCheckIn.id)}
      >
        I'm safe
      </button>
    </div>
  );
}
