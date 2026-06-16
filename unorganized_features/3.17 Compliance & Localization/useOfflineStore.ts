// store/useOfflineStore.ts
// Tracks connectivity and queues mutations that fail while offline.
// On reconnect, the queue is drained via syncQueue().

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type QueuedAction = {
  id: string;
  type: string; // e.g. "location_update" | "trip_status" | "consent_update"
  payload: unknown;
  createdAt: number;
  retries: number;
};

interface OfflineState {
  isOnline: boolean;
  queue: QueuedAction[];
  isSyncing: boolean;
  lastSyncedAt: number | null;

  setOnline: (online: boolean) => void;
  enqueue: (action: Omit<QueuedAction, "id" | "createdAt" | "retries">) => void;
  dequeue: (id: string) => void;
  clearQueue: () => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
      queue: [],
      isSyncing: false,
      lastSyncedAt: null,

      setOnline: (isOnline) => set({ isOnline }),

      enqueue: (action) =>
        set((state) => ({
          queue: [
            ...state.queue,
            {
              ...action,
              id: crypto.randomUUID(),
              createdAt: Date.now(),
              retries: 0,
            },
          ],
        })),

      dequeue: (id) =>
        set((state) => ({
          queue: state.queue.filter((a) => a.id !== id),
        })),

      clearQueue: () => set({ queue: [] }),

      setSyncing: (isSyncing) => set({ isSyncing }),

      markSynced: () =>
        set({
          lastSyncedAt: Date.now(),
          isSyncing: false,
          queue: [],
        }),
    }),
    {
      name: "pikii-offline-queue",
      storage: createJSONStorage(() =>
        // Fall back to memory if localStorage is unavailable
        typeof localStorage !== "undefined" ? localStorage : sessionStorage
      ),
      // Don't persist isSyncing — always start as false
      partialize: (s) => ({ queue: s.queue, lastSyncedAt: s.lastSyncedAt }),
    }
  )
);
