"use client";

import React, { useEffect, useState } from "react";

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState({
    pushEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
  });

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data.preferences) setPrefs(data.preferences);
      });
  }, []);

  const togglePref = async (key: string) => {
    const updated = { ...prefs, [key]: !(prefs as any)[key] };
    setPrefs(updated);
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: updated[key as keyof typeof updated] }),
    });
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Notification Preferences</h1>
      
      <div className="space-y-4">
        <label className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
          <span>Push Notifications</span>
          <input type="checkbox" checked={prefs.pushEnabled} onChange={() => togglePref("pushEnabled")} />
        </label>
        
        <label className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
          <span>SMS Notifications</span>
          <input type="checkbox" checked={prefs.smsEnabled} onChange={() => togglePref("smsEnabled")} />
        </label>
        
        <label className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
          <span>In-App Notifications</span>
          <input type="checkbox" checked={prefs.inAppEnabled} onChange={() => togglePref("inAppEnabled")} />
        </label>
      </div>
    </div>
  );
}
