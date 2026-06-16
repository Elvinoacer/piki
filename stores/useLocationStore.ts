/**
 * stores/useLocationStore.ts
 *
 * Device GPS state + rider online/offline status.
 * Includes offline queue for location updates when WebSocket drops.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";

// ─── Types ───────────────────────────────────────────────────

export interface DevicePosition {
  lat: number;
  lng: number;
  heading?: number;
  accuracy?: number;
  speedKmh?: number;
  ts: number;
}

export interface QueuedLocationPoint extends DevicePosition {
  tripId?: string;
}

interface LocationState {
  position:       DevicePosition | null;
  isOnline:       boolean;          // Rider's platform online status (not connectivity)
  hasPermission:  boolean | null;   // GPS permission: null=unknown, true=granted, false=denied
  offlineQueue:   QueuedLocationPoint[];
  watchId:        number | null;
}

interface LocationActions {
  setPosition:       (pos: DevicePosition) => void;
  setOnline:         (online: boolean) => void;
  setPermission:     (granted: boolean) => void;
  setWatchId:        (id: number | null) => void;
  enqueueLocation:   (point: QueuedLocationPoint) => void;
  flushQueue:        () => QueuedLocationPoint[];
  clearQueue:        () => void;
}

// ─── Store ───────────────────────────────────────────────────

export const useLocationStore = create<LocationState & LocationActions>()(
  persist(
    immer((set, get) => ({
      // State
      position:      null,
      isOnline:      false,
      hasPermission: null,
      offlineQueue:  [],
      watchId:       null,

      // Actions
      setPosition: (pos) =>
        set((s) => {
          s.position = pos;
        }),

      setOnline: (online) =>
        set((s) => {
          s.isOnline = online;
        }),

      setPermission: (granted) =>
        set((s) => {
          s.hasPermission = granted;
        }),

      setWatchId: (id) =>
        set((s) => {
          s.watchId = id;
        }),

      enqueueLocation: (point) =>
        set((s) => {
          // Cap queue at 200 points to avoid unbounded memory growth
          if (s.offlineQueue.length >= 200) {
            s.offlineQueue.shift();
          }
          s.offlineQueue.push(point);
        }),

      flushQueue: () => {
        const queue = get().offlineQueue;
        set((s) => { s.offlineQueue = []; });
        return queue;
      },

      clearQueue: () =>
        set((s) => { s.offlineQueue = []; }),
    })),
    {
      name:    "pikii:location",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : {
          getItem:    () => null,
          setItem:    () => undefined,
          removeItem: () => undefined,
        }
      ),
      // Only persist the offline queue and online status across page reloads
      partialize: (s) => ({
        isOnline:     s.isOnline,
        offlineQueue: s.offlineQueue,
      }),
    }
  )
);
