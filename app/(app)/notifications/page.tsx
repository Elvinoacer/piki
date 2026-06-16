"use client";

import React, { useEffect, useState } from "react";
import { NotificationItem } from "@/components/notifications/NotificationItem";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications || []));
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH", body: JSON.stringify({}) });
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button onClick={markAllRead} className="text-sm text-blue-600">Mark all as read</button>
      </div>

      <div className="space-y-4">
        {notifications.map((n) => (
          <NotificationItem key={n.id} notification={n} />
        ))}
        {notifications.length === 0 && <p className="text-gray-500">No notifications yet.</p>}
      </div>
    </div>
  );
}
