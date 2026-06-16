"use client";

// components/compliance/OfflineBanner.tsx
// Mounts at root layout. Shows connectivity status + queued action count.
// Registers global online/offline listeners via useOfflineSync.

import { useOfflineStore } from "@/store/useOfflineStore";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useTranslation } from "@/hooks/useTranslation";
import { WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  // Register sync listeners at root
  useOfflineSync();

  const { isOnline, queue, isSyncing, setSyncing } = useOfflineStore();
  const { t } = useTranslation();

  if (isOnline && queue.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        isOnline ? "bg-amber-50 text-amber-800" : "bg-destructive/10 text-destructive"
      )}
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {!isOnline
          ? t("offline_banner")
          : t("offline_queue_label", { count: queue.length })}
      </span>

      {isOnline && queue.length > 0 && (
        <button
          onClick={() => {
            // Trigger manual drain by toggling online — useOfflineSync watches this
            setSyncing(false);
            window.dispatchEvent(new Event("online"));
          }}
          disabled={isSyncing}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-amber-100 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          {isSyncing ? t("offline_syncing") : t("offline_sync_now")}
        </button>
      )}
    </div>
  );
}
