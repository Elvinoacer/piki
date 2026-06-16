// src/components/notifications/NotificationItem.tsx
"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Bell,
  Car,
  CheckCircle,
  XCircle,
  Wallet,
  MessageCircle,
  AlertTriangle,
  Tag,
} from "lucide-react";
import type { NotificationRecord, NotificationType } from "@/types/communication";

const ICON_MAP: Record<NotificationType, React.ReactNode> = {
  TRIP_REQUESTED: <Car className="w-4 h-4" />,
  TRIP_ACCEPTED: <Car className="w-4 h-4" />,
  RIDER_ARRIVING: <Car className="w-4 h-4" />,
  RIDER_ARRIVED: <Car className="w-4 h-4" />,
  TRIP_STARTED: <Car className="w-4 h-4" />,
  TRIP_COMPLETED: <CheckCircle className="w-4 h-4" />,
  TRIP_CANCELLED: <XCircle className="w-4 h-4" />,
  PAYMENT_RECEIVED: <Wallet className="w-4 h-4" />,
  PAYOUT_PROCESSED: <Wallet className="w-4 h-4" />,
  PROMO_AVAILABLE: <Tag className="w-4 h-4" />,
  DOCUMENT_EXPIRING: <AlertTriangle className="w-4 h-4" />,
  CHAT_MESSAGE: <MessageCircle className="w-4 h-4" />,
  SYSTEM: <Bell className="w-4 h-4" />,
};

const COLOR_MAP: Record<NotificationType, string> = {
  TRIP_REQUESTED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  TRIP_ACCEPTED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  RIDER_ARRIVING: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  RIDER_ARRIVED: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  TRIP_STARTED: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  TRIP_COMPLETED: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  TRIP_CANCELLED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  PAYMENT_RECEIVED: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  PAYOUT_PROCESSED: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  PROMO_AVAILABLE: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  DOCUMENT_EXPIRING: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  CHAT_MESSAGE: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
  SYSTEM: "bg-muted text-muted-foreground",
};

interface NotificationItemProps {
  notification: NotificationRecord;
  onRead: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter();
  const isUnread = !notification.readAt;
  const timestamp = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });

  const handleClick = () => {
    if (isUnread) onRead(notification.id);

    // Deep-link routing based on notification data
    const data = notification.data as { tripId?: string; screen?: string } | null;
    if (data?.tripId) {
      if (notification.type === "CHAT_MESSAGE") {
        router.push(`/chat/${data.tripId}`);
      } else {
        router.push(`/trips/${data.tripId}`);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-muted/50 active:bg-muted",
        isUnread && "bg-primary/5"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5",
          COLOR_MAP[notification.type]
        )}
      >
        {ICON_MAP[notification.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", isUnread && "font-semibold")}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">{timestamp}</p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" aria-label="Unread" />
      )}
    </button>
  );
}
