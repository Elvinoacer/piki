// app/(rider)/layout.tsx
// Rider route group layout — wraps all rider-facing pages

import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Pikii Rider", template: "%s — Pikii Rider" },
  description: "Bodaboda rider app by Pikii",
};

export default function RiderLayout({ children }: { children: ReactNode }) {
  return (
    // Viewport meta is handled by Next.js automatically.
    // Add any rider-specific providers here (SessionProvider is in root layout).
    <>{children}</>
  );
}
