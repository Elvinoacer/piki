// src/components/chat/ChatHeader.tsx
"use client";

import { ArrowLeft, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

interface ChatHeaderProps {
  tripId: string;
  isActive: boolean;
  otherPartyLabel: "Rider" | "Client"; // shown masked
}

export function ChatHeader({ tripId, isActive, otherPartyLabel }: ChatHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-10">
      <button
        onClick={() => router.back()}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Masked avatar */}
      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-secondary-foreground">
        {otherPartyLabel[0]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{otherPartyLabel}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Phone number hidden until trip ends
        </p>
      </div>

      {/* Status pill */}
      <span
        className={
          isActive
            ? "text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium"
            : "text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium"
        }
      >
        {isActive ? "Active" : "Closed"}
      </span>
    </div>
  );
}
