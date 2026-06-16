// src/components/chat/ChatRoom.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth/hooks";
import { Loader2, LockKeyhole } from "lucide-react";
import { useChatStore } from "@/store/useCommunicationStore";
import { useChatChannel } from "@/lib/pusher/hooks";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { ChatHeader } from "./ChatHeader";
import type { ChatMessage } from "@/types/communication";

interface ChatRoomProps {
  tripId: string;
}

export function ChatRoom({ tripId }: ChatRoomProps) {
  const { data: session } = useSession();
  
  let currentUserId = "";
  let otherPartyLabel: "Rider" | "Client" = "Client";
  if (session?.accessToken) {
    try {
      const payload = JSON.parse(atob(session.accessToken.split('.')[1]));
      currentUserId = payload.sub;
      otherPartyLabel = payload.role === "RIDER" ? "Client" : "Rider";
    } catch (e) {}
  }

  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const {
    messages,
    isActive,
    isLoading,
    cursor,
    hasMore,
    setMessages,
    prependMessages,
    addMessage,
    setChatActive,
    setChatLoading,
    setCursor,
    setHasMore,
    reset,
  } = useChatStore();

  // Subscribe to Pusher real-time events
  useChatChannel(tripId);

  // ── Initial load ─────────────────────────────────────────────────────────────
  useEffect(() => {
    reset();
    fetchMessages(null);

    // Also fetch room info for isActive status
    fetch(`/api/chat/${tripId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.room) setChatActive(d.room.isActive);
      });

    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Infinite scroll — load older messages when top sentinel is visible ────────
  useEffect(() => {
    if (!hasMore || isLoading) return;
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) fetchMessages(cursor);
      },
      { threshold: 0.1 }
    );

    if (topRef.current) observerRef.current.observe(topRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, isLoading, cursor]);

  // ── Fetch messages ────────────────────────────────────────────────────────────
  const fetchMessages = useCallback(
    async (cursorId: string | null) => {
      setChatLoading(true);
      try {
        const url = new URL(`/api/chat/${tripId}/messages`, window.location.origin);
        if (cursorId) url.searchParams.set("cursor", cursorId);
        url.searchParams.set("limit", "30");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to load messages");

        const data: { messages: ChatMessage[]; cursor: string | null } = await res.json();

        if (cursorId) {
          prependMessages(data.messages);
        } else {
          setMessages(data.messages);
        }
        setCursor(data.cursor);
        setHasMore(data.cursor !== null);
      } catch (err) {
        console.error("[ChatRoom] fetch error:", err);
      } finally {
        setChatLoading(false);
      }
    },
    [tripId, setChatLoading, prependMessages, setMessages, setCursor, setHasMore]
  );

  // ── Send message ──────────────────────────────────────────────────────────────
  const handleSend = async (body: string) => {
    // Optimistic UI: add a temp message immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      roomId: "",
      senderId: currentUserId,
      senderName: "Me",
      body,
      type: "TEXT",
      readAt: null,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    addMessage(optimistic);

    const res = await fetch(`/api/chat/${tripId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (res.ok) {
      const { message }: { message: ChatMessage } = await res.json();
      // Replace optimistic with real message from server
      addMessage({ ...message });
    }
    // If failed, the optimistic message stays — you can add error handling here
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <ChatHeader
        tripId={tripId}
        isActive={isActive}
        otherPartyLabel={otherPartyLabel}
      />

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {/* Top sentinel for infinite scroll */}
        <div ref={topRef} className="h-1" />

        {/* Load-older indicator */}
        {isLoading && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
            <LockKeyhole className="w-8 h-8 opacity-40" />
            <p className="text-sm text-center">
              Messages are only visible to you and your {otherPartyLabel.toLowerCase()}.
              <br />
              Phone numbers remain hidden.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isMine={msg.senderId === currentUserId}
          />
        ))}

        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>

      {/* Closed chat banner */}
      {!isActive && (
        <div className="px-4 py-2 bg-muted text-center text-xs text-muted-foreground border-t">
          This chat has been closed because the trip ended.
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={!isActive} />
    </div>
  );
}
