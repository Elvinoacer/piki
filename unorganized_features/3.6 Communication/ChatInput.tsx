// src/components/chat/ChatInput.tsx
"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (body: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message…",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = value.trim().length > 0 && !disabled && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    const body = value.trim();
    setValue("");
    // Reset height
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="flex items-end gap-2 p-3 border-t bg-background">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? "Chat closed" : placeholder}
        disabled={disabled || sending}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-all min-h-[38px] max-h-[120px] overflow-y-auto"
        )}
      />

      <button
        onClick={handleSend}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full transition-all shrink-0",
          canSend
            ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
