"use client";
// src/components/ratings/BadgeChip.tsx

import type React from "react";
import { BadgeCheck, Flame, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_META } from "@/types/ratings";
import type { BadgeType } from "@/types/ratings";

interface BadgeChipProps {
  type: BadgeType;
  size?: "sm" | "md";
  className?: string;
}

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  green: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
};

const BADGE_ICONS: Record<BadgeType, React.ReactNode> = {
  VERIFIED: <BadgeCheck className="w-full h-full" />,
  TOP_RATED: <Star className="w-full h-full" />,
  FIVE_STAR_STREAK: <Flame className="w-full h-full" />,
  SACCO_CERTIFIED: <ShieldCheck className="w-full h-full" />,
};

export function BadgeChip({ type, size = "md", className }: BadgeChipProps) {
  const meta = BADGE_META[type];
  const colors = COLOR_CLASSES[meta.color];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colors,
        className
      )}
      title={meta.description}
    >
      {BADGE_ICONS[type]}
      {meta.label}
    </span>
  );
}
