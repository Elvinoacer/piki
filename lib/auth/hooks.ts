"use client";

import { useEffect, useState } from "react";

export function useSession() {
  const [session, setSession] = useState<{ accessToken?: string } | null>(null);

  useEffect(() => {
    // In a real app with custom JWT auth, this might read from a cookie or localStorage
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) {
      setSession({ accessToken: token });
    }
  }, []);

  return { data: session };
}
