// store/safetyStore.ts
// Client-side state for all safety features.

import { create } from "zustand";
import type { TrustedContact, NightCheckIn } from "@/types/safety";

interface SosState {
  sosActive: boolean;
  sosEventId: string | null;
  triggerSos: (tripId?: string) => Promise<void>;
  clearSos: () => void;
}

interface TripShareState {
  shareUrl: string | null;
  shareToken: string | null;
  shareLoading: boolean;
  generateShareLink: (tripId: string) => Promise<void>;
  clearShareLink: () => void;
}

interface CheckInState {
  pendingCheckIn: NightCheckIn | null;
  setPendingCheckIn: (c: NightCheckIn | null) => void;
  respondToCheckIn: (checkInId: string) => Promise<void>;
}

interface TrustedContactsState {
  contacts: TrustedContact[];
  setContacts: (c: TrustedContact[]) => void;
  addContact: (name: string, phone: string) => Promise<void>;
  removeContact: (contactId: string) => Promise<void>;
}

interface RatingState {
  ratingPending: boolean;
  setRatingPending: (v: boolean) => void;
}

type SafetyStore = SosState &
  TripShareState &
  CheckInState &
  TrustedContactsState &
  RatingState;

export const useSafetyStore = create<SafetyStore>((set, get) => ({
  // ── SOS ───────────────────────────────────────────────────────────────────
  sosActive: false,
  sosEventId: null,

  triggerSos: async (tripId?: string) => {
    if (!navigator.geolocation) return;

    const position = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
    );

    const res = await fetch("/api/safety/sos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
    });

    if (res.ok) {
      const { sosEventId } = await res.json();
      set({ sosActive: true, sosEventId });
    }
  },

  clearSos: () => set({ sosActive: false, sosEventId: null }),

  // ── Trip Share ─────────────────────────────────────────────────────────────
  shareUrl: null,
  shareToken: null,
  shareLoading: false,

  generateShareLink: async (tripId: string) => {
    set({ shareLoading: true });
    const res = await fetch("/api/safety/trip-sharing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (res.ok) {
      const data = await res.json();
      set({ shareUrl: data.shareUrl, shareToken: data.token, shareLoading: false });
    } else {
      set({ shareLoading: false });
    }
  },

  clearShareLink: () => set({ shareUrl: null, shareToken: null }),

  // ── Night Check-in ─────────────────────────────────────────────────────────
  pendingCheckIn: null,
  setPendingCheckIn: (c) => set({ pendingCheckIn: c }),

  respondToCheckIn: async (checkInId: string) => {
    await fetch("/api/safety/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkInId }),
    });
    set({ pendingCheckIn: null });
  },

  // ── Trusted Contacts ───────────────────────────────────────────────────────
  contacts: [],
  setContacts: (contacts) => set({ contacts }),

  addContact: async (name: string, phone: string) => {
    const res = await fetch("/api/safety/trusted-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    if (res.ok) {
      const contact: TrustedContact = await res.json();
      set((s) => ({ contacts: [...s.contacts, contact] }));
    }
  },

  removeContact: async (contactId: string) => {
    await fetch(`/api/safety/trusted-contacts/${contactId}`, { method: "DELETE" });
    set((s) => ({ contacts: s.contacts.filter((c) => c.id !== contactId) }));
  },

  // ── Rating ─────────────────────────────────────────────────────────────────
  ratingPending: false,
  setRatingPending: (v) => set({ ratingPending: v }),
}));
