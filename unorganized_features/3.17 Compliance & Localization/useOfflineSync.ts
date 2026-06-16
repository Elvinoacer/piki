// hooks/useOfflineSync.ts
// Mount once at the root layout. Listens to online/offline browser events,
// drains the offline queue when connectivity is restored.

"use client";

import { useEffect, useCallback } from "react";
import { useOfflineStore, type QueuedAction } from "@/store/useOfflineStore";

// -------------------------------------------------------------------------
// Per-action-type flush handlers
// Register new action types here as the app grows.
// -------------------------------------------------------------------------
async function flushAction(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case "location_update": {
      const res = await fetch("/api/rider/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      if (!res.ok) throw new Error("location_update failed");
      break;
    }
    case "trip_status": {
      const res = await fetch("/api/trips/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      if (!res.ok) throw new Error("trip_status failed");
      break;
    }
    case "consent_update": {
      const res = await fetch("/api/user/consent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload),
      });
      if (!res.ok) throw new Error("consent_update failed");
      break;
    }
    default:
      console.warn("[OfflineSync] Unknown action type:", action.type);
  }
}

const MAX_RETRIES = 5;

export function useOfflineSync() {
  const { setOnline, queue, dequeue, setSyncing, isSyncing } = useOfflineStore();

  const drainQueue = useCallback(async () => {
    if (isSyncing || queue.length === 0) return;

    setSyncing(true);
    for (const action of queue) {
      try {
        await flushAction(action);
        dequeue(action.id);
      } catch (err) {
        console.error("[OfflineSync] Failed to flush action:", action.type, err);
        // Increment retry counter; give up after MAX_RETRIES
        if (action.retries >= MAX_RETRIES) {
          console.warn("[OfflineSync] Dropping action after max retries:", action.id);
          dequeue(action.id);
        }
      }
    }
    setSyncing(false);
  }, [isSyncing, queue, dequeue, setSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      drainQueue();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Drain on mount in case we re-hydrate with a queued backlog
    if (navigator.onLine && queue.length > 0) drainQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [drainQueue, queue.length, setOnline]);
}
