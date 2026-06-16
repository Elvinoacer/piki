// src/components/chat/ChatBubble.tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/communication";

interface ChatBubbleProps {
  message: ChatMessage;
  isMine: boolean;
}

export function ChatBubble({ message, isMine }: ChatBubbleProps) {
  const isSystem = message.type === "SYSTEM";
  const isDeleted = !!message.deletedAt;
  const timestamp = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  // ── System messages (automated status) ──────────────────────────────────────
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 max-w-[80%]",
        isMine ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
      )}
    >
      {/* Avatar initial */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 mt-auto",
          isMine
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground"
        )}
      >
        {isMine ? "Me" : message.senderName[0]}
      </div>

      <div className={cn("flex flex-col gap-0.5", isMine ? "items-end" : "items-start")}>
        {/* Sender label (masked: "Rider" or "Client") */}
        {!isMine && (
          <span className="text-[11px] text-muted-foreground font-medium px-1">
            {message.senderName}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "relative px-3 py-2 rounded-2xl text-sm leading-snug max-w-xs break-words",
            isMine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm",
            isDeleted && "italic opacity-60"
          )}
        >
          {message.body}
        </div>

        {/* Timestamp + read receipt */}
        <div className="flex items-center gap-1 px-1">
          <span className="text-[10px] text-muted-foreground">{timestamp}</span>
          {isMine && (
            <span className="text-muted-foreground">
              {message.readAt ? (
                <CheckCheck className="w-3 h-3 text-primary" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
